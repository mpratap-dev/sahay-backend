import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsSender } from './sms-sender';

@Injectable()
export class ConsoleSmsSender implements SmsSender {
  private readonly logger = new Logger(ConsoleSmsSender.name);

  constructor(private readonly configService: ConfigService) {}

  sendOtp(e164: string, code: string): Promise<void> {
    const devLog = this.configService.get<string>('OTP_DEV_LOG') === 'true';
    const production = this.configService.get('NODE_ENV') === 'production';
    if (devLog && !production) {
      this.logger.warn(`OTP_DEV_LOG SMS to ${e164}: ${code}`);
      return Promise.resolve();
    }
    this.logger.log(`SMS OTP queued for ${e164} (console sender)`);
    return Promise.resolve();
  }
}
