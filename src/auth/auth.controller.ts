import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { CurrentUserId } from './current-user.decorator';
import {
  LogoutDto,
  OauthDto,
  RefreshDto,
  StartOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/start')
  @HttpCode(200)
  startOtp(@Body() body: StartOtpDto, @Req() req: Request) {
    return this.authService.startOtp(
      body.channel,
      body.destination,
      clientIp(req),
    );
  }

  @Post('otp/verify')
  @HttpCode(200)
  verifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(
      body.channel,
      body.destination,
      body.code,
      body.deviceId,
    );
  }

  @Post('oauth')
  @HttpCode(200)
  oauth(@Body() body: OauthDto) {
    return this.authService.oauth(
      body.provider,
      body.idToken,
      body.nonce,
      body.deviceId,
    );
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body.refreshToken, body.deviceId);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async logout(@CurrentUserId() userId: string, @Body() body: LogoutDto) {
    await this.authService.logout(userId, body.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse()
  me(@CurrentUserId() userId: string) {
    return this.authService.me(userId);
  }
}

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? 'unknown';
}
