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

    const name = normalizeName(payload.name);
    const imageUrl = normalizeImageUrl(payload.picture);

    return {
      provider: 'GOOGLE',
      subject: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      ...(name ? { name } : {}),
      ...(imageUrl ? { imageUrl } : {}),
    };
  }
}

function normalizeName(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeImageUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
