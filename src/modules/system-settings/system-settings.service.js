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

  return {
    checkedAt: new Date().toISOString(),
    database,
    integrations: {
      telegram: Boolean(env.TELEGRAM_BOT_TOKEN),
      email: Boolean(env.GMAIL_SMTP_USER && env.GMAIL_APP_PASSWORD),
      cloudinary: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
      browserNotifications: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
    },
  };
}
