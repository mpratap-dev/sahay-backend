export const OTP_CHANNEL = {
  SMS: 'sms',
  EMAIL: 'email',
} as const;

export type OtpChannel = (typeof OTP_CHANNEL)[keyof typeof OTP_CHANNEL];

const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class IdentifierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentifierError';
  }
}

export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (!EMAIL.test(email)) {
    throw new IdentifierError('Invalid email address');
  }
  return email;
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  let e164 = digits;

  if (/^\d{10}$/.test(digits) && /^[6-9]/.test(digits)) {
    e164 = `+91${digits}`;
  } else if (/^91\d{10}$/.test(digits)) {
    e164 = `+${digits}`;
  } else if (digits.startsWith('+')) {
    e164 = `+${digits.slice(1).replace(/\D/g, '')}`;
  }

  if (!E164.test(e164)) {
    throw new IdentifierError('Invalid phone number');
  }
  return e164;
}

export function normalizeDestination(
  channel: OtpChannel,
  destination: string,
): string {
  return channel === OTP_CHANNEL.EMAIL
    ? normalizeEmail(destination)
    : normalizePhone(destination);
}
