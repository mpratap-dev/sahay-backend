import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailSender } from './email-sender';

@Injectable()
export class ConsoleEmailSender implements EmailSender {
  private readonly logger = new Logger(ConsoleEmailSender.name);

  constructor(private readonly configService: ConfigService) {}

  sendOtp(to: string, code: string): Promise<void> {
    const devLog = this.configService.get<string>('OTP_DEV_LOG') === 'true';
    const production = this.configService.get('NODE_ENV') === 'production';
    if (devLog && !production) {
      this.logger.warn(`OTP_DEV_LOG email to ${to}: ${code}`);
      return Promise.resolve();
    }
    this.logger.log(`Email OTP queued for ${to} (console sender)`);
    return Promise.resolve();
  }
}
