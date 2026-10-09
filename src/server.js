import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { redis } from './config/redis.js';
import { logger } from './common/utils/logger.js';
import { startNotificationWorker } from './jobs/workers/notification.worker.js';
import { closeNotificationQueue } from './jobs/queues/index.js';

async function main() {
  await connectDatabase();
  const notificationWorker = startNotificationWorker();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, environment: env.NODE_ENV }, 'API listening');
    logger.info({ url: `http://localhost:${env.PORT}/docs` }, 'API documentation available');
  });

  server.on('error', (err) => {
    logger.fatal({ err, port: env.PORT }, 'Failed to start API listener');
    process.exit(1);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await notificationWorker.close();
      await closeNotificationQueue();
      await disconnectDatabase();
      redis.disconnect();
      process.exit(0);
    });

    // Force-exit if graceful shutdown hangs.
    globalThis.setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error during startup');
  process.exit(1);
});
