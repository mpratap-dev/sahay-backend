import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailSender } from './email-sender';

const RESEND_URL = 'https://api.resend.com/emails';

@Injectable()
export class ResendEmailSender implements EmailSender {
  private readonly logger = new Logger(ResendEmailSender.name);

  constructor(private readonly configService: ConfigService) {}

  async sendOtp(to: string, code: string): Promise<void> {
    const apiKey = this.configService.getOrThrow<string>('RESEND_API_KEY');
    const from = this.configService.getOrThrow<string>('OTP_EMAIL_FROM');

    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Your SAHAY verification code',
        text: `Your SAHAY verification code is ${code}. It expires in 5 minutes. If you did not request this, ignore this email.`,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Resend HTTP ${response.status}: ${body}`);
      throw new Error('Failed to send email OTP');
    }
  }
}
