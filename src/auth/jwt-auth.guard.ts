import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export type AuthRequestUser = { userId: string };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }
    const token = header.slice('Bearer '.length);
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      if (!payload.sub) {
        throw new UnauthorizedException();
      }
      (request as Request & { user: AuthRequestUser }).user = {
        userId: payload.sub,
      };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
