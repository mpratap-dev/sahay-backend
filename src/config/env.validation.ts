import { z } from 'zod';

const DEV_JWT_ACCESS = 'dev-only-jwt-access-secret-do-not-use-in-prod';
const DEV_JWT_REFRESH = 'dev-only-jwt-refresh-secret-do-not-use-in-prod';
const DEV_OTP_PEPPER = 'dev-only-otp-pepper-change-me';

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    PORT: z.coerce.number().int().positive().default(3001),

    DATABASE_URL: z.url(),

    REDIS_HOST: z.string().min(1).default('localhost'),

    REDIS_PORT: z.coerce.number().int().positive().default(6379),

    /** Comma-separated CORS origins or bare ports (dev only). Example: 3000,59012 */
    CORS_ORIGINS: z.string().optional(),

    JWT_ACCESS_SECRET: z.string().min(32).default(DEV_JWT_ACCESS),
    JWT_REFRESH_SECRET: z.string().min(32).default(DEV_JWT_REFRESH),
    OTP_PEPPER: z.string().min(16).default(DEV_OTP_PEPPER),

    OTP_SMS_PROVIDER: z.enum(['console', 'msg91', 'stub']).default('console'),
    OTP_EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
    OTP_DEV_LOG: z.enum(['true', 'false']).optional(),

    MSG91_AUTH_KEY: z.string().optional(),
    MSG91_OTP_TEMPLATE_ID: z.string().optional(),
    MSG91_OTP_VAR: z.string().default('otp'),

    RESEND_API_KEY: z.string().optional(),
    OTP_EMAIL_FROM: z.string().optional(),

    GOOGLE_CLIENT_IDS: z.string().min(1),
    APPLE_CLIENT_IDS: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (data.JWT_ACCESS_SECRET === DEV_JWT_ACCESS) {
        ctx.addIssue({
          code: 'custom',
          path: ['JWT_ACCESS_SECRET'],
          message: 'Set JWT_ACCESS_SECRET in production',
        });
      }
      if (data.JWT_REFRESH_SECRET === DEV_JWT_REFRESH) {
        ctx.addIssue({
          code: 'custom',
          path: ['JWT_REFRESH_SECRET'],
          message: 'Set JWT_REFRESH_SECRET in production',
        });
      }
      if (data.OTP_PEPPER === DEV_OTP_PEPPER) {
        ctx.addIssue({
          code: 'custom',
          path: ['OTP_PEPPER'],
          message: 'Set OTP_PEPPER in production',
        });
      }
    }

    if (data.OTP_EMAIL_PROVIDER === 'resend') {
      if (!data.RESEND_API_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['RESEND_API_KEY'],
          message: 'RESEND_API_KEY is required when OTP_EMAIL_PROVIDER=resend',
        });
      }
      if (!data.OTP_EMAIL_FROM) {
        ctx.addIssue({
          code: 'custom',
          path: ['OTP_EMAIL_FROM'],
          message: 'OTP_EMAIL_FROM is required when OTP_EMAIL_PROVIDER=resend',
        });
      }
    }

    if (data.OTP_SMS_PROVIDER === 'msg91') {
      if (!data.MSG91_AUTH_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['MSG91_AUTH_KEY'],
          message: 'MSG91_AUTH_KEY is required when OTP_SMS_PROVIDER=msg91',
        });
      }
      if (!data.MSG91_OTP_TEMPLATE_ID) {
        ctx.addIssue({
          code: 'custom',
          path: ['MSG91_OTP_TEMPLATE_ID'],
          message:
            'MSG91_OTP_TEMPLATE_ID is required when OTP_SMS_PROVIDER=msg91',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  return envSchema.parse(config);
}
