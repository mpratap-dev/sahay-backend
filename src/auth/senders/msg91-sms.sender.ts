import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsSender } from './sms-sender';

const MSG91_FLOW_URL = 'https://control.msg91.com/api/v5/flow';

@Injectable()
export class Msg91SmsSender implements SmsSender {
  private readonly logger = new Logger(Msg91SmsSender.name);

  constructor(private readonly configService: ConfigService) {}

  async sendOtp(e164: string, code: string): Promise<void> {
    const authKey = this.configService.getOrThrow<string>('MSG91_AUTH_KEY');
    const templateId = this.configService.getOrThrow<string>(
      'MSG91_OTP_TEMPLATE_ID',
    );
    const varName = this.configService.get<string>('MSG91_OTP_VAR') ?? 'otp';
    const mobiles = e164.replace(/^\+/, '');

    const response = await fetch(MSG91_FLOW_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authkey: authKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        template_id: templateId,
        short_url: '0',
        recipients: [
          {
            mobiles,
            [varName]: code,
            VAR1: code,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`MSG91 HTTP ${response.status}: ${body}`);
      throw new Error('Failed to send SMS OTP');
    }
  }
}
