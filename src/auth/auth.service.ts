import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthProvider } from '../generated/prisma/enums';
import type { OtpChannel } from './identifiers';
import {
  APPLE_TOKEN_VERIFIER,
  GOOGLE_TOKEN_VERIFIER,
  type OauthProfile,
  type OauthProvider,
  type OauthTokenVerifier,
} from './oauth/oauth-token.verifier';
import { OtpService } from './otp.service';
import { TokenService, type TokenPair } from './token.service';

export type AuthUserView = {
  id: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
  identities: { provider: AuthProvider; providerSubject: string }[];
};

export type SessionResponse = TokenPair & { user: AuthUserView };

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    @Inject(GOOGLE_TOKEN_VERIFIER)
    private readonly googleVerifier: OauthTokenVerifier,
    @Inject(APPLE_TOKEN_VERIFIER)
    private readonly appleVerifier: OauthTokenVerifier,
  ) {}

  startOtp(channel: OtpChannel, destination: string, ip: string) {
    return this.otpService.start(channel, destination, ip);
  }

  async verifyOtp(
    channel: OtpChannel,
    destination: string,
    code: string,
    deviceId?: string,
  ): Promise<SessionResponse> {
    const normalized = await this.otpService.verify(channel, destination, code);
    const user =
      channel === 'sms'
        ? await this.upsertPhoneUser(normalized)
        : await this.upsertEmailUser(normalized);
    return this.sessionFor(user.id, deviceId);
  }

  async oauth(
    provider: OauthProvider,
    idToken: string,
    nonce?: string,
    deviceId?: string,
  ): Promise<SessionResponse> {
    const verifier =
      provider === 'google' ? this.googleVerifier : this.appleVerifier;
    let profile: OauthProfile;
    try {
      profile = await verifier.verify(idToken, nonce);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid identity token');
    }

    const userId = await this.upsertOauthUser(profile);
    return this.sessionFor(userId, deviceId);
  }

  async refresh(refreshToken: string, deviceId?: string) {
    try {
      const rotated = await this.tokenService.rotate(refreshToken, deviceId);
      const user = await this.requireUser(rotated.userId);
      return {
        accessToken: rotated.accessToken,
        refreshToken: rotated.refreshToken,
        expiresIn: rotated.expiresIn,
        user: this.toView(user),
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, refreshToken: string) {
    await this.tokenService.revoke(refreshToken, userId);
  }

  async me(userId: string): Promise<AuthUserView> {
    return this.toView(await this.requireUser(userId));
  }

  private async sessionFor(
    userId: string,
    deviceId?: string,
  ): Promise<SessionResponse> {
    const tokens = await this.tokenService.issue(userId, deviceId);
    const user = await this.requireUser(userId);
    return { ...tokens, user: this.toView(user) };
  }

  private async upsertPhoneUser(phone: string) {
    const identity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: AuthProvider.PHONE,
          providerSubject: phone,
        },
      },
    });
    if (identity) {
      return this.requireUser(identity.userId);
    }

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      await this.prisma.authIdentity.create({
        data: {
          userId: existing.id,
          provider: AuthProvider.PHONE,
          providerSubject: phone,
        },
      });
      return existing;
    }

    try {
      return await this.prisma.user.create({
        data: {
          phone,
          identities: {
            create: {
              provider: AuthProvider.PHONE,
              providerSubject: phone,
            },
          },
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return this.prisma.user.findUniqueOrThrow({ where: { phone } });
      }
      throw error;
    }
  }

  private async upsertEmailUser(email: string) {
    const identity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: AuthProvider.EMAIL,
          providerSubject: email,
        },
      },
    });
    if (identity) {
      return this.requireUser(identity.userId);
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      await this.prisma.authIdentity.create({
        data: {
          userId: existing.id,
          provider: AuthProvider.EMAIL,
          providerSubject: email,
        },
      });
      return existing;
    }

    try {
      return await this.prisma.user.create({
        data: {
          email,
          identities: {
            create: {
              provider: AuthProvider.EMAIL,
              providerSubject: email,
            },
          },
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return this.prisma.user.findUniqueOrThrow({ where: { email } });
      }
      throw error;
    }
  }

  private async upsertOauthUser(profile: OauthProfile): Promise<string> {
    const existingIdentity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: profile.provider,
          providerSubject: profile.subject,
        },
      },
    });
    if (existingIdentity) {
      await this.backfillProfileFromOauth(existingIdentity.userId, profile);
      return existingIdentity.userId;
    }

    const email =
      profile.emailVerified && profile.email
        ? profile.email.trim().toLowerCase()
        : undefined;

    if (email) {
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        console.log('byEmail', byEmail);
        await this.prisma.authIdentity.create({
          data: {
            userId: byEmail.id,
            provider: profile.provider,
            providerSubject: profile.subject,
          },
        });
        await this.backfillProfileFromOauth(byEmail.id, profile);
        return byEmail.id;
      }

      const created = await this.prisma.user.create({
        data: {
          email,
          ...oauthProfileFields(profile),
          identities: {
            create: {
              provider: profile.provider,
              providerSubject: profile.subject,
            },
          },
        },
      });
      return created.id;
    }

    throw new BadRequestException(
      'Email is required to create an account with this provider',
    );
  }

  private async requireUser(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { identities: true },
    });
  }

  private async backfillProfileFromOauth(
    userId: string,
    profile: OauthProfile,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, imageUrl: true },
    });
    console.log('profile', profile);
    console.log('user', user);
    const data: { name?: string; imageUrl?: string } = {};
    if (user.name === null && profile.name) {
      data.name = profile.name;
    }
    if (user.imageUrl === null && profile.imageUrl) {
      data.imageUrl = profile.imageUrl;
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.user.update({ where: { id: userId }, data });
    }
  }

  private toView(user: {
    id: string;
    phone: string | null;
    email: string | null;
    name: string | null;
    imageUrl: string | null;
    identities: { provider: AuthProvider; providerSubject: string }[];
  }): AuthUserView {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      name: user.name,
      imageUrl: user.imageUrl,
      identities: user.identities.map((identity) => ({
        provider: identity.provider,
        providerSubject: identity.providerSubject,
      })),
    };
  }
}

function oauthProfileFields(profile: OauthProfile): {
  name?: string;
  imageUrl?: string;
} {
  return {
    ...(profile.name ? { name: profile.name } : {}),
    ...(profile.imageUrl ? { imageUrl: profile.imageUrl } : {}),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
