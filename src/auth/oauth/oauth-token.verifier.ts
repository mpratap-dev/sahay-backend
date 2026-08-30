export type OauthProvider = 'google' | 'apple';

export type OauthProfile = {
  provider: 'GOOGLE' | 'APPLE';
  subject: string;
  email?: string;
  emailVerified: boolean;
};

export const GOOGLE_TOKEN_VERIFIER = Symbol('GOOGLE_TOKEN_VERIFIER');
export const APPLE_TOKEN_VERIFIER = Symbol('APPLE_TOKEN_VERIFIER');

export interface OauthTokenVerifier {
  verify(idToken: string, nonce?: string): Promise<OauthProfile>;
}
