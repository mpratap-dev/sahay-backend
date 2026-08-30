import { createHash } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jose from 'jose';
import type { OauthProfile, OauthTokenVerifier } from './oauth-token.verifier';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS = jose.createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys'),
);

@Injectable()
export class AppleTokenVerifier implements OauthTokenVerifier {
  constructor(private readonly configService: ConfigService) {}

  async verify(idToken: string, nonce?: string): Promise<OauthProfile> {
    const audiences = parseCsv(
      this.configService.get<string>('APPLE_CLIENT_IDS'),
    );
    if (audiences.length === 0) {
      throw new ServiceUnavailableException('Apple sign-in is not configured');
    }

    const { payload } = await jose.jwtVerify(idToken, APPLE_JWKS, {
      issuer: APPLE_ISSUER,
      audience: audiences,
    });

    if (nonce) {
      const claimed = typeof payload.nonce === 'string' ? payload.nonce : '';
      const hashed = createHash('sha256').update(nonce).digest('hex');
      if (claimed !== nonce && claimed !== hashed) {
        throw new Error('Invalid Apple nonce');
      }
    }

    const subject = payload.sub;
    if (!subject || typeof subject !== 'string') {
      throw new Error('Invalid Apple token');
    }

    const email = typeof payload.email === 'string' ? payload.email : undefined;
    const emailVerified =
      payload.email_verified === true || payload.email_verified === 'true';

    return {
      provider: 'APPLE',
      subject,
      email,
      emailVerified,
    };
  }
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
