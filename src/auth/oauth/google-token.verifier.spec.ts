import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleTokenVerifier } from './google-token.verifier';

const verifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken,
  })),
}));

describe('GoogleTokenVerifier', () => {
  let verifier: GoogleTokenVerifier;

  beforeEach(() => {
    verifyIdToken.mockReset();
    verifier = new GoogleTokenVerifier({
      get: jest.fn().mockReturnValue('client-id-1'),
    } as ConfigService);
  });

  it('maps name and picture from a valid Google token', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub',
        email: 'user@example.com',
        email_verified: true,
        name: ' Jane Doe ',
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
      }),
    });

    const profile = await verifier.verify('id-token');

    expect(profile).toEqual({
      provider: 'GOOGLE',
      subject: 'google-sub',
      email: 'user@example.com',
      emailVerified: true,
      name: 'Jane Doe',
      imageUrl: 'https://lh3.googleusercontent.com/photo.jpg',
    });
  });

  it('omits empty name and invalid picture URLs', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub',
        email_verified: false,
        name: '   ',
        picture: 'not-a-url',
      }),
    });

    const profile = await verifier.verify('id-token');

    expect(profile).toEqual({
      provider: 'GOOGLE',
      subject: 'google-sub',
      emailVerified: false,
    });
  });

  it('throws when Google sign-in is not configured', async () => {
    verifier = new GoogleTokenVerifier({
      get: jest.fn().mockReturnValue(undefined),
    } as ConfigService);

    await expect(verifier.verify('id-token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
