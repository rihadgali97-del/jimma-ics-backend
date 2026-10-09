import webPush from 'web-push';
import { env } from '../../../../config/env.js';

let configured = false;

export async function sendPush(pushSubscription, message) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    throw new Error('Web Push delivery requires VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY');
  }
  if (!pushSubscription) {
    throw new Error('The saved browser push subscription is no longer available');
  }

  if (!configured) {
    webPush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    configured = true;
  }

  await webPush.sendNotification({
    endpoint: pushSubscription.endpoint,
    keys: { p256dh: pushSubscription.p256dh, auth: pushSubscription.auth },
  }, JSON.stringify(message), { TTL: 60 * 60 });
}
