import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { env } from '../../config/env.js';

export const bullConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const notificationQueue = new Queue('notification-dispatch', {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: 1000,
    removeOnFail: false,
  },
});

export async function scheduleNotification(notificationLogId) {
  const jobId = `notification-${notificationLogId}`;
  const existing = await notificationQueue.getJob(jobId);
  if (existing && await existing.getState() === 'failed') await existing.remove();
  return notificationQueue.add(
    'deliver',
    { notificationLogId },
    { jobId }
  );
}

export async function closeNotificationQueue() {
  await notificationQueue.close();
  await bullConnection.quit();
}
