import 'dotenv/config';
import { URL } from 'node:url';
import { z } from 'zod';

// Fail fast on boot if required configuration is missing or malformed —
// never fall back to hardcoded secrets/defaults in production.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('/api/v1'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(30),

  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),

  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(10),

  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  CLOUDINARY_COUNCIL_DOCUMENTS_FOLDER: z.string().default('council-documents'),
  CLOUDINARY_DIRECTORY_IMAGES_FOLDER: z.string().default('council-directory'),

  LOG_LEVEL: z.string().default('info'),

  // --- Notification provider credentials (optional until configured) ---
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHANNEL_ID: z.string().default('@riho_information'),
  GMAIL_SMTP_USER: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.string().email().optional()
  ),
  GMAIL_APP_PASSWORD: z.string().optional(),
  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  GMAIL_REFRESH_TOKEN: z.string().optional(),
  GMAIL_OAUTH2_USER: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.string().email().optional()
  ),
  EMAIL_FROM_ADDRESS: z.string().optional(),
  WEB_APP_URL: z.string().url(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:admin@jimmaislamiccouncil.org'),
});

const productionConfigSchema = envSchema.superRefine((config, context) => {
  if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_REFRESH_SECRET'],
      message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
    });
  }

  if (config.NODE_ENV !== 'production') return;

  let databaseUrl;
  try {
    databaseUrl = new URL(config.DATABASE_URL);
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['DATABASE_URL'],
      message: 'DATABASE_URL must be a valid MySQL connection URL',
    });
  }

  if (databaseUrl) {
    if (databaseUrl.protocol !== 'mysql:') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL must use the mysql: protocol',
      });
    }
    if (
      !databaseUrl.hostname ||
      ['localhost', '127.0.0.1', '::1', '[::1]'].includes(databaseUrl.hostname)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL must point to the hosted production database',
      });
    }
    if (databaseUrl.searchParams.get('sslaccept') !== 'strict') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'Set sslaccept=strict in DATABASE_URL to verify the database TLS certificate',
      });
    }
  }

  let redisUrl;
  try {
    redisUrl = new URL(config.REDIS_URL);
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['REDIS_URL'],
      message: 'REDIS_URL must be a valid redis: or rediss: connection URL',
    });
  }

  if (redisUrl) {
    if (!['redis:', 'rediss:'].includes(redisUrl.protocol)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message: 'REDIS_URL must use the redis: or rediss: protocol',
      });
    }
    if (
      !redisUrl.hostname ||
      ['localhost', '127.0.0.1', '::1', '[::1]'].includes(redisUrl.hostname)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message: 'REDIS_URL must point to the hosted production Redis service',
      });
    }
  }

  try {
    if (new URL(config.WEB_APP_URL).protocol !== 'https:') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['WEB_APP_URL'],
        message: 'WEB_APP_URL must use HTTPS in production',
      });
    }
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['WEB_APP_URL'],
      message: 'WEB_APP_URL must be a valid HTTPS URL',
    });
  }

  if (config.CORS_ORIGIN === '*') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CORS_ORIGIN'],
      message: 'CORS_ORIGIN must be set to the production frontend HTTPS origin',
    });
    return;
  }

  try {
    const origin = new URL(config.CORS_ORIGIN);
    if (origin.protocol !== 'https:' || origin.origin !== config.CORS_ORIGIN) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message: 'CORS_ORIGIN must be a single HTTPS origin without a path',
      });
    }
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CORS_ORIGIN'],
      message: 'CORS_ORIGIN must be a valid HTTPS origin',
    });
  }
});

const parsed = productionConfigSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';