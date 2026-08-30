export const SMS_SENDER = Symbol('SMS_SENDER');

export interface SmsSender {
  sendOtp(e164: string, code: string): Promise<void>;
}
