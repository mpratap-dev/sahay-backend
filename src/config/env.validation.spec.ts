import { validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://sahay:sahay@localhost:5432/sahay',
};

describe('validateEnv', () => {
  it('defaults OTP providers to console', () => {
    const env = validateEnv({ ...base });
    expect(env.OTP_SMS_PROVIDER).toBe('console');
    expect(env.OTP_EMAIL_PROVIDER).toBe('console');
  });

  it('requires Resend keys when email provider is resend', () => {
    expect(() =>
      validateEnv({ ...base, OTP_EMAIL_PROVIDER: 'resend' }),
    ).toThrow();
  });

  it('accepts Resend when keys are present', () => {
    const env = validateEnv({
      ...base,
      OTP_EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test',
      OTP_EMAIL_FROM: 'SAHAY <noreply@example.com>',
    });
    expect(env.OTP_EMAIL_PROVIDER).toBe('resend');
  });

  it('requires MSG91 keys when sms provider is msg91', () => {
    expect(() =>
      validateEnv({ ...base, OTP_SMS_PROVIDER: 'msg91' }),
    ).toThrow();
  });

  it('rejects production with default JWT secrets', () => {
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production' }),
    ).toThrow();
  });
});
