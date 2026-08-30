import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

const ACCESS_EXPIRES = '15m';
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async issue(userId: string, deviceId?: string): Promise<TokenPair> {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId },
      { expiresIn: ACCESS_EXPIRES },
    );
    const refreshToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashRefresh(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        deviceId,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
    return { accessToken, refreshToken, expiresIn: 15 * 60 };
  }

  async rotate(
    refreshToken: string,
    deviceId?: string,
  ): Promise<TokenPair & { userId: string }> {
    const tokenHash = this.hashRefresh(refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (
      !existing ||
      existing.revokedAt ||
      existing.expiresAt.getTime() < Date.now()
    ) {
      throw new Error('invalid_refresh');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const pair = await this.issue(
      existing.userId,
      deviceId ?? existing.deviceId ?? undefined,
    );
    return { ...pair, userId: existing.userId };
  }

  async revoke(refreshToken: string, userId: string): Promise<void> {
    const tokenHash = this.hashRefresh(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashRefresh(token: string): string {
    const secret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    return createHash('sha256').update(`${secret}:${token}`).digest('hex');
  }
}
