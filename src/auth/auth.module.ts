import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  APPLE_TOKEN_VERIFIER,
  GOOGLE_TOKEN_VERIFIER,
} from './oauth/oauth-token.verifier';
import { AppleTokenVerifier } from './oauth/apple-token.verifier';
import { GoogleTokenVerifier } from './oauth/google-token.verifier';
import { OtpService } from './otp.service';
import { ConsoleEmailSender } from './senders/console-email.sender';
import { ConsoleSmsSender } from './senders/console-sms.sender';
import { EMAIL_SENDER } from './senders/email-sender';
import { Msg91SmsSender } from './senders/msg91-sms.sender';
import { ResendEmailSender } from './senders/resend-email.sender';
import { SMS_SENDER } from './senders/sms-sender';
import { StubSmsSender } from './senders/stub-sms.sender';
import { TokenService } from './token.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokenService,
    JwtAuthGuard,
    ConsoleSmsSender,
    ConsoleEmailSender,
    Msg91SmsSender,
    ResendEmailSender,
    StubSmsSender,
    GoogleTokenVerifier,
    AppleTokenVerifier,
    {
      provide: SMS_SENDER,
      inject: [ConfigService, ConsoleSmsSender, Msg91SmsSender, StubSmsSender],
      useFactory: (
        config: ConfigService,
        consoleSender: ConsoleSmsSender,
        msg91: Msg91SmsSender,
        stub: StubSmsSender,
      ) => {
        const provider = config.get<string>('OTP_SMS_PROVIDER') ?? 'console';
        if (provider === 'msg91') {
          return msg91;
        }
        if (provider === 'stub') {
          return stub;
        }
        return consoleSender;
      },
    },
    {
      provide: EMAIL_SENDER,
      inject: [ConfigService, ConsoleEmailSender, ResendEmailSender],
      useFactory: (
        config: ConfigService,
        consoleSender: ConsoleEmailSender,
        resend: ResendEmailSender,
      ) => {
        const provider = config.get<string>('OTP_EMAIL_PROVIDER') ?? 'console';
        return provider === 'resend' ? resend : consoleSender;
      },
    },
    { provide: GOOGLE_TOKEN_VERIFIER, useExisting: GoogleTokenVerifier },
    { provide: APPLE_TOKEN_VERIFIER, useExisting: AppleTokenVerifier },
  ],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
