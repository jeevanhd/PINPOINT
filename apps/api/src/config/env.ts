import 'dotenv/config';
import { z } from 'zod';

const booleanish = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    WEB_ORIGIN: z.string().default('http://localhost:5173'),
    PUBLIC_API_URL: z.string().default('http://localhost:4000'),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().optional().default(''),

    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),

    GEMINI_API_KEY: z.string().optional().default(''),
    GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
    AI_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(86400),

    STORAGE_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
    LOCAL_STORAGE_DIR: z.string().default('./storage'),
    CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
    CLOUDINARY_API_KEY: z.string().optional().default(''),
    CLOUDINARY_API_SECRET: z.string().optional().default(''),

    MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),
    MAX_PAGES_PER_TOPIC: z.coerce.number().int().positive().max(2).default(2),

    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    SEED_ON_BOOT: booleanish,
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_DRIVER === 'cloudinary') {
      for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=cloudinary`,
          });
        }
      }
    }
    if (value.NODE_ENV === 'production' && value.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be at least 32 characters in production',
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env: Env = loadEnv();

export const isTest = env.NODE_ENV === 'test';
export const isProduction = env.NODE_ENV === 'production';
export const redisEnabled = env.REDIS_URL.trim().length > 0;
export const aiEnabled = env.GEMINI_API_KEY.trim().length > 0;
