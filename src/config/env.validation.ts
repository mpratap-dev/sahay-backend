import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.url(),

  REDIS_HOST: z.string().min(1).default('localhost'),

  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  /** Comma-separated CORS origins or bare ports (dev only). Example: 3000,59012 */
  CORS_ORIGINS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  return envSchema.parse(config);
}
