import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  APPLE_TOKEN_VERIFIER,
  GOOGLE_TOKEN_VERIFIER,
} from './oauth/oauth-token.verifier';
import { AuthProvider } from '../generated/prisma/enums';

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {
    signAsync() {
      return Promise.resolve('token');
    }
  },
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    authIdentity: { findUnique: jest.Mock; create: jest.Mock };
    user: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
    };
  };
  let googleVerifier: { verify: jest.Mock };
  let appleVerifier: { verify: jest.Mock };
  let tokenService: { issue: jest.Mock };

  const userRow = {
    id: 'user-1',
    phone: null,
    email: 'a@example.com',
    identities: [
      {
        provider: AuthProvider.EMAIL,
        providerSubject: 'a@example.com',
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      authIdentity: { findUnique: jest.fn(), create: jest.fn() },
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(userRow),
        create: jest.fn(),
      },
    };
    googleVerifier = { verify: jest.fn() };
    appleVerifier = { verify: jest.fn() };
    tokenService = {
      issue: jest.fn().mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        expiresIn: 900,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: OtpService,
          useValue: { start: jest.fn(), verify: jest.fn() },
        },
        { provide: TokenService, useValue: tokenService },
        { provide: PrismaService, useValue: prisma },
        { provide: GOOGLE_TOKEN_VERIFIER, useValue: googleVerifier },
        { provide: APPLE_TOKEN_VERIFIER, useValue: appleVerifier },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('creates a user from a first Google sign-in with verified email', async () => {
    googleVerifier.verify.mockResolvedValue({
      provider: 'GOOGLE',
      subject: 'sub-1',
      email: 'a@example.com',
      emailVerified: true,
    });
    prisma.authIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'user-1' });

    const result = await service.oauth('google', 'id-token');
    expect(prisma.user.create).toHaveBeenCalled();
    expect(result.accessToken).toBe('a');
    expect(result.user.email).toBe('a@example.com');
  });

  it('links Google to an existing email user', async () => {
    googleVerifier.verify.mockResolvedValue({
      provider: 'GOOGLE',
      subject: 'sub-2',
      email: 'a@example.com',
      emailVerified: true,
    });
    prisma.authIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
    });

    await service.oauth('google', 'id-token');
    expect(prisma.authIdentity.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        provider: 'GOOGLE',
        providerSubject: 'sub-2',
      },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('returns an existing Apple user by sub without requiring email again', async () => {
    appleVerifier.verify.mockResolvedValue({
      provider: 'APPLE',
      subject: 'apple-sub',
      emailVerified: false,
    });
    prisma.authIdentity.findUnique.mockResolvedValue({
      userId: 'user-1',
      provider: 'APPLE',
      providerSubject: 'apple-sub',
    });

    await service.oauth('apple', 'id-token');
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(tokenService.issue).toHaveBeenCalledWith('user-1', undefined);
  });

  it('rejects first-time OAuth without a verified email', async () => {
    googleVerifier.verify.mockResolvedValue({
      provider: 'GOOGLE',
      subject: 'sub-new',
      emailVerified: false,
    });
    prisma.authIdentity.findUnique.mockResolvedValue(null);

    await expect(service.oauth('google', 'id-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
