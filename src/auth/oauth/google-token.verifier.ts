import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import type { OauthProfile, OauthTokenVerifier } from './oauth-token.verifier';

@Injectable()
export class GoogleTokenVerifier implements OauthTokenVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly configService: ConfigService) {}

  async verify(idToken: string): Promise<OauthProfile> {
    const audiences = parseCsv(
      this.configService.get<string>('GOOGLE_CLIENT_IDS'),
    );
    if (audiences.length === 0) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }

    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: audiences,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) {
      throw new Error('Invalid Google token');
    }

    return {
      provider: 'GOOGLE',
      subject: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
    };
  }
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
