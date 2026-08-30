export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface EmailSender {
  sendOtp(to: string, code: string): Promise<void>;
}
