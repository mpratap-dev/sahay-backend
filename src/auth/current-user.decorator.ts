import {
  UnauthorizedException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthRequestUser } from './jwt-auth.guard';

export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: AuthRequestUser }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return user.userId;
  },
);
