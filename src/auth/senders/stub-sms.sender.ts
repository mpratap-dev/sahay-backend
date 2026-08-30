import { Injectable } from '@nestjs/common';
import type { SmsSender } from './sms-sender';

/** In-memory sender for tests and OTP_SMS_PROVIDER=stub. */
@Injectable()
export class StubSmsSender implements SmsSender {
  last?: { e164: string; code: string };

  sendOtp(e164: string, code: string): Promise<void> {
    this.last = { e164, code };
    return Promise.resolve();
  }
}
