import { Worker } from 'bullmq';
import { bullConnection, scheduleNotification } from '../queues/index.js';
import { prisma } from '../../config/database.js';
import { logger } from '../../common/utils/logger.js';
import { dispatch } from '../../common/services/notifications/dispatch.js';
import { notificationsRepository } from '../../modules/notifications/notifications.repository.js';

let schedulerTimer;
let scheduling = false;

async function scheduleDueNotifications() {
  if (scheduling) return;
  scheduling = true;
  try {
    const due = await notificationsRepository.findDueQueued();
    await Promise.all(due.map(({ id }) => scheduleNotification(id)));
  } catch (err) {
    logger.error({ err }, 'Notification outbox scheduling failed; it will retry on the next interval');
  } finally {
    scheduling = false;
  }
}

export function startNotificationWorker() {
  const worker = new Worker(
    'notification-dispatch',
    async (job) => {
      const { notificationLogId } = job.data;
      const log = await notificationsRepository.findNotificationLog(notificationLogId);
      if (!log) {
        logger.warn({ notificationLogId }, 'NotificationLog not found — skipping job');
        return;
      }
      if (log.status === 'SENT' || log.status === 'CANCELLED') return;

      try {
        await dispatch(log.channel, log.recipient, log.payload, log.pushSubscription);
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: { status: 'SENT', sentAt: new Date(), errorMessage: null },
        });
      } catch (err) {
        if (log.channel === 'WEB_PUSH' && [404, 410].includes(err.statusCode) && log.pushSubscription) {
          await notificationsRepository.deletePushSubscription(log.pushSubscription.id);
          if (await notificationsRepository.countPushSubscriptions(log.pushSubscription.subscriptionId) === 0) {
            await notificationsRepository.disableBrowserNotifications(log.pushSubscription.subscriptionId);
          }
        }
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: 'FAILED',
            errorMessage: String(err.message ?? err).slice(0, 5000),
          },
        });
        throw err;
      }
    },
    { connection: bullConnection, concurrency: 5 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Notification delivery attempt failed');
  });

  void scheduleDueNotifications();
  schedulerTimer = globalThis.setInterval(() => void scheduleDueNotifications(), 15_000);
  schedulerTimer.unref();
  logger.info('Notification worker and outbox scheduler started');
  return {
    worker,
    async close() {
      globalThis.clearInterval(schedulerTimer);
      await worker.close();
    },
  };
}
