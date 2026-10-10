import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import { logger } from '../../common/utils/logger.js';

export async function getSystemSettingsStatus() {
  let database = 'connected';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    database = 'unavailable';
    logger.warn({ err: error }, 'System settings check could not reach the database');
  }

  const oauthRequested = Boolean(
    env.GMAIL_CLIENT_ID || env.GMAIL_CLIENT_SECRET || env.GMAIL_REFRESH_TOKEN || env.GMAIL_OAUTH2_USER
  );
  const emailConfigured = oauthRequested
    ? Boolean(env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN && (env.GMAIL_OAUTH2_USER || env.GMAIL_SMTP_USER))
    : Boolean(env.GMAIL_SMTP_USER && env.GMAIL_APP_PASSWORD);

  return {
    checkedAt: new Date().toISOString(),
    database,
    integrations: {
      telegram: Boolean(env.TELEGRAM_BOT_TOKEN),
      email: emailConfigured,
      cloudinary: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
      browserNotifications: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
    },
  };
}
