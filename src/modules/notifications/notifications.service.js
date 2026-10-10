import { randomBytes, randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { ConflictError, NotFoundError } from '../../common/errors/httpErrors.js';
import { buildPaginationMeta, parsePagination } from '../../common/utils/pagination.js';
import { notificationsRepository } from './notifications.repository.js';
import { sendTelegram } from '../../common/services/notifications/providers/telegram.provider.js';

function toSubscriptionData(data) {
  const email = data.email?.trim() || null;
  return {
    ...data,
    email,
    normalizedEmail: email?.toLowerCase() || null,
    specificEventIds: data.specificEventIds.map(String),
  };
}

function toPublicSubscription(subscription) {
  return {
    id: String(subscription.id),
    email: subscription.email || '',
    emailVerified: subscription.emailVerified,
    name: subscription.name,
    enableEmail: subscription.enableEmail,
    enableBrowser: subscription.enableBrowser,
    enableAnnouncements: subscription.enableAnnouncements,
    categories: subscription.categories,
    districts: subscription.districts,
    reminderTiming: subscription.reminderTiming,
    specificEventIds: subscription.specificEventIds,
    subscribedAt: subscription.subscribedAt.toISOString().slice(0, 10),
  };
}

export async function getSubscription(manageToken) {
  const subscription = await notificationsRepository.findSubscriptionByToken(manageToken);
  if (!subscription) throw new NotFoundError('Notification subscription not found');
  return toPublicSubscription(subscription);
}

async function queueUpcomingEventNotifications() {
  const events = await notificationsRepository.findUpcomingPublishedEvents(new Date());
  for (const event of events) {
    await queueEventNotifications(event);
  }
}

async function queueEmailVerification(subscription, token) {
  await notificationsRepository.enqueueMany([{
    channel: 'EMAIL',
    notificationType: 'EMAIL_VERIFICATION',
    recipient: subscription.email,
    payload: {
      subject: 'Verify your Jimma Islamic Council notification email',
      title: 'Verify your email address',
      summary: 'Confirm that this email address belongs to you to activate email notifications.',
      verificationUrl: `${env.WEB_APP_URL.replace(/\/$/, '')}/?notificationVerification=${encodeURIComponent(token)}`,
    },
    status: 'QUEUED',
    scheduledAt: new Date(),
    deduplicationKey: `email-verification:${subscription.id}:${token}`,
  }]);
}

export async function saveSubscription(data, manageToken) {
  const subscriptionData = toSubscriptionData(data);

  if (manageToken) {
    const existing = await notificationsRepository.findSubscriptionByToken(manageToken);
    if (!existing) throw new NotFoundError('Notification subscription not found');
    if (subscriptionData.normalizedEmail && subscriptionData.normalizedEmail !== existing.normalizedEmail) {
      const owner = await notificationsRepository.findSubscriptionByEmail(subscriptionData.normalizedEmail);
      if (owner && owner.id !== existing.id) {
        throw new ConflictError('This email address is already associated with another notification subscription');
      }
    }

    const emailChanged = subscriptionData.normalizedEmail !== existing.normalizedEmail;
    const needsVerification = Boolean(
      (data.enableEmail || data.enableAnnouncements) &&
      subscriptionData.email &&
      (!existing.emailVerified || emailChanged)
    );
    const verificationToken = needsVerification ? randomBytes(32).toString('hex') : null;
    await notificationsRepository.cancelQueuedForSubscription(existing.id);
    const subscription = await notificationsRepository.updateSubscription(existing.id, {
      ...subscriptionData,
      emailVerified: !emailChanged && existing.emailVerified,
      emailVerificationToken: verificationToken,
      emailVerificationExpiresAt: verificationToken ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
    });
    if (verificationToken) await queueEmailVerification(subscription, verificationToken);
    await queueUpcomingEventNotifications();
    return { ...toPublicSubscription(subscription), manageToken, created: false };
  }

  if (subscriptionData.normalizedEmail) {
    const existing = await notificationsRepository.findSubscriptionByEmail(subscriptionData.normalizedEmail);
    if (existing) {
      throw new ConflictError('A subscription already exists for this email in another browser. Manage it from the browser where it was created.');
    }
  }

  const newManageToken = randomBytes(32).toString('hex');
  const verificationToken = (data.enableEmail || data.enableAnnouncements) && subscriptionData.email
    ? randomBytes(32).toString('hex')
    : null;
  const subscription = await notificationsRepository.createSubscription({
    ...subscriptionData,
    manageToken: newManageToken,
    emailVerified: false,
    emailVerificationToken: verificationToken,
    emailVerificationExpiresAt: verificationToken ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
  });
  if (verificationToken) await queueEmailVerification(subscription, verificationToken);
  await queueUpcomingEventNotifications();
  return { ...toPublicSubscription(subscription), manageToken: newManageToken, created: true };
}

export async function verifyEmail(token) {
  const subscription = await notificationsRepository.findSubscriptionByVerificationToken(token);
  if (!subscription || !subscription.emailVerificationExpiresAt || subscription.emailVerificationExpiresAt <= new Date()) {
    throw new NotFoundError('Email verification link is invalid or expired');
  }
  const verifiedSubscription = await notificationsRepository.markEmailVerified(subscription.id);
  await queueUpcomingEventNotifications();
  return toPublicSubscription(verifiedSubscription);
}

export async function savePushSubscription(manageToken, data) {
  const subscription = await notificationsRepository.findSubscriptionByToken(manageToken);
  if (!subscription) throw new NotFoundError('Notification subscription not found');
  if (!subscription.enableBrowser) throw new ConflictError('Enable browser notifications before registering this device');
  await notificationsRepository.upsertPushSubscription(subscription.id, {
    endpoint: data.endpoint,
    p256dh: data.keys.p256dh,
    auth: data.keys.auth,
  });
  await queueUpcomingEventNotifications();
  return { registered: true };
}

export async function removePushSubscription(manageToken, endpoint) {
  const subscription = await notificationsRepository.findSubscriptionByToken(manageToken);
  if (!subscription) throw new NotFoundError('Notification subscription not found');
  await notificationsRepository.deletePushSubscriptionByEndpoint(subscription.id, endpoint);
}

export function getPushConfiguration() {
  return {
    enabled: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
    publicKey: env.VAPID_PUBLIC_KEY || null,
  };
}

export async function removeSubscription(manageToken) {
  const subscription = await notificationsRepository.findSubscriptionByToken(manageToken);
  if (!subscription) throw new NotFoundError('Notification subscription not found');
  await notificationsRepository.cancelQueuedForSubscription(subscription.id);
  await notificationsRepository.deleteSubscription(subscription.id);
}

export async function listNotificationLogs(query) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const { items, totalItems } = await notificationsRepository.listLogs({
    skip,
    take,
    status: query.status,
  });
  return { items, meta: buildPaginationMeta({ page, pageSize, totalItems }) };
}

export async function retryNotificationLog(id) {
  const existing = await notificationsRepository.findLogStatus(id);
  if (!existing) throw new NotFoundError('Notification log not found');
  if (existing.status !== 'FAILED') throw new ConflictError('Only failed notifications can be retried');
  await notificationsRepository.requeueFailedLog(id);
  return { id: String(id), status: 'QUEUED' };
}

export function getTelegramGatewayStatus() {
  return {
    enabled: Boolean(env.TELEGRAM_BOT_TOKEN),
    channelId: env.TELEGRAM_CHANNEL_ID,
  };
}

export async function sendTelegramGatewayBroadcast({ title, content, category }) {
  const log = await notificationsRepository.createTelegramGatewayLog({
    channel: 'TELEGRAM',
    notificationType: 'ADMIN_GATEWAY_BROADCAST',
    referenceType: category,
    recipient: env.TELEGRAM_CHANNEL_ID,
    payload: { title, content, category },
    status: 'SENDING',
    scheduledAt: new Date(),
    deduplicationKey: `admin-telegram:${randomUUID()}`,
  });

  try {
    const result = await sendTelegram(env.TELEGRAM_CHANNEL_ID, { title, summary: content });
    await notificationsRepository.updateTelegramGatewayLog(log.id, {
      status: 'SENT',
      sentAt: new Date(),
      payload: { title, content, category, messageId: result.messageId },
    });
    return {
      id: String(log.id),
      channelId: env.TELEGRAM_CHANNEL_ID,
      messageId: result.messageId,
    };
  } catch (error) {
    await notificationsRepository.updateTelegramGatewayLog(log.id, {
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : 'Unknown Telegram delivery error',
    });
    throw error;
  }
}

export async function listTelegramGatewayHistory(query) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const { items, totalItems } = await notificationsRepository.listTelegramGatewayLogs({
    skip,
    take,
    status: query.status,
  });
  return {
    items: items.map((item) => ({
      id: String(item.id),
      title: item.payload.title,
      category: item.payload.category,
      content: item.payload.content,
      messageId: item.payload.messageId || null,
      channelId: item.recipient,
      status: item.status,
      sentAt: item.sentAt?.toISOString() || null,
      errorMessage: item.errorMessage,
      createdAt: item.createdAt.toISOString(),
    })),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  };
}

function matchesFilter(filters, value) {
  return filters.includes('All') || filters.includes(value);
}

function eventStartTime(event) {
  const date = event.date.toISOString().slice(0, 10);
  const time = event.time.split(/\s+-\s+/)[0].trim();
  const match = time.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  let hours = match ? Number(match[1]) : 9;
  let minutes = match ? Number(match[2]) : 0;

  if (match?.[3]) {
    const meridiem = match[3].toUpperCase();
    if (hours < 1 || hours > 12 || minutes > 59) {
      hours = 9;
      minutes = 0;
    } else {
      hours = (hours % 12) + (meridiem === 'PM' ? 12 : 0);
    }
  } else if (hours > 23 || minutes > 59) {
    hours = 9;
    minutes = 0;
  }

  // Council event times are local to Jimma (EAT, UTC+3); Ethiopia has no DST.
  return new Date(new Date(`${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`).getTime() - 3 * 60 * 60 * 1000);
}

function scheduledTime(event, timing, now) {
  const eventTime = eventStartTime(event);
  if (timing === 'instant') return now;
  if (timing === '24h_before') return new Date(eventTime.getTime() - 24 * 60 * 60 * 1000);
  if (timing === '48h_before') return new Date(eventTime.getTime() - 48 * 60 * 60 * 1000);

  const localNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const digestLocal = new Date(localNow);
  digestLocal.setUTCDate(digestLocal.getUTCDate() + (5 - digestLocal.getUTCDay() + 7) % 7);
  digestLocal.setUTCHours(8, 0, 0, 0);
  if (digestLocal <= localNow) digestLocal.setUTCDate(digestLocal.getUTCDate() + 7);
  const digestUtc = new Date(digestLocal.getTime() - 3 * 60 * 60 * 1000);
  return digestUtc < eventTime ? digestUtc : null;
}

function eventPayload(event) {
  return {
    title: event.title,
    category: event.category,
    date: event.date.toISOString().slice(0, 10),
    time: event.time,
    location: event.location,
    district: event.district,
    description: event.description,
  };
}

function emailEventLog(subscription, event, scheduledAt, notificationType) {
  const versionKey = [
    event.updatedAt?.toISOString() || event.date.toISOString(),
    subscription.updatedAt?.toISOString() || subscription.createdAt?.toISOString() || 'current',
  ].join(':');
  return {
    subscriptionId: subscription.id,
    channel: 'EMAIL',
    notificationType,
    referenceType: 'event',
    referenceId: event.id,
    recipient: subscription.email,
    payload: {
      ...eventPayload(event),
      subject: `${notificationType === 'EVENT_REMINDER' ? 'Reminder: ' : ''}${event.title}`,
    },
    status: 'QUEUED',
    scheduledAt,
    deduplicationKey: `event:${event.id}:subscription:${subscription.id}:${notificationType}:${versionKey}:${scheduledAt.toISOString()}`,
  };
}

function pushEventLog(subscription, pushSubscription, event, scheduledAt, notificationType) {
  const versionKey = [
    event.updatedAt?.toISOString() || event.date.toISOString(),
    subscription.updatedAt?.toISOString() || subscription.createdAt?.toISOString() || 'current',
  ].join(':');
  return {
    subscriptionId: subscription.id,
    pushSubscriptionId: pushSubscription.id,
    channel: 'WEB_PUSH',
    notificationType,
    referenceType: 'event',
    referenceId: event.id,
    recipient: String(pushSubscription.id),
    payload: {
      title: event.title,
      body: `${event.date.toISOString().slice(0, 10)} ${event.time} • ${event.location}`,
      url: '/events',
    },
    status: 'QUEUED',
    scheduledAt,
    deduplicationKey: `event:${event.id}:push:${pushSubscription.id}:${notificationType}:${versionKey}:${scheduledAt.toISOString()}`,
  };
}

function telegramEventLog(event, scheduledAt, notificationType) {
  return {
    channel: 'TELEGRAM',
    notificationType,
    referenceType: 'event',
    referenceId: event.id,
    recipient: env.TELEGRAM_CHANNEL_ID,
    payload: eventPayload(event),
    status: 'QUEUED',
    scheduledAt,
    deduplicationKey: `event:${event.id}:telegram:${notificationType}:${event.updatedAt?.toISOString() || event.date.toISOString()}`,
  };
}

export async function queueEventNotifications(event, { reason = 'published' } = {}) {
  if (!event.isPublished || (event.status === 'Cancelled' && reason !== 'cancelled')) return 0;

  const subscriptions = await notificationsRepository.findMatchingEventSubscriptions();
  const now = new Date();
  const immediate = reason === 'updated' || reason === 'cancelled';
  const notificationType = reason === 'cancelled'
    ? 'EVENT_CANCELLED'
    : immediate ? 'EVENT_UPDATE' : 'EVENT_REMINDER';
  const records = subscriptions
    .filter((subscription) => (
      matchesFilter(subscription.categories, event.category) &&
      matchesFilter(subscription.districts, event.district) &&
      (matchesFilter(subscription.specificEventIds, String(event.id)) || subscription.specificEventIds.length === 0)
    ))
    .flatMap((subscription) => {
      if (!immediate && eventStartTime(event) <= now) return [];
      let reminder = immediate ? now : scheduledTime(event, subscription.reminderTiming, now);
      if (reminder && reminder < now && eventStartTime(event) > now) reminder = now;
      if (!reminder || reminder < now) return [];
      const items = [];
      if (subscription.enableEmail && subscription.emailVerified && subscription.email) {
        items.push(emailEventLog(subscription, event, reminder, notificationType));
      }
      if (subscription.enableBrowser) {
        for (const pushSubscription of subscription.pushSubscriptions) {
          items.push(pushEventLog(subscription, pushSubscription, event, reminder, notificationType));
        }
      }
      return items;
    });

  records.push(telegramEventLog(event, now, immediate ? notificationType : 'EVENT_PUBLISHED'));
  return notificationsRepository.enqueueMany(records);
}

export async function cancelQueuedEventNotifications(eventId) {
  await notificationsRepository.cancelQueuedForReference('event', eventId);
}

export async function cancelQueuedAnnouncementNotifications(announcementId) {
  await notificationsRepository.cancelQueuedForReference('announcement', announcementId);
}

export async function queueAnnouncementNotifications(announcement) {
  if (!announcement.isPublished) return 0;
  const urgent = announcement.isUrgent || announcement.priority === 'High';
  const subscriptions = urgent ? await notificationsRepository.findAnnouncementSubscriptions() : [];
  const scheduledAt = new Date();
  const records = subscriptions
    .filter((subscription) => !announcement.district || matchesFilter(subscription.districts, announcement.district))
    .map((subscription) => ({
      subscriptionId: subscription.id,
      channel: 'EMAIL',
      notificationType: 'URGENT_ANNOUNCEMENT',
      referenceType: 'announcement',
      referenceId: announcement.id,
      recipient: subscription.email,
      payload: {
        subject: `Urgent announcement: ${announcement.title}`,
        title: announcement.title,
        category: announcement.category,
        summary: announcement.summary,
        content: announcement.content,
        district: announcement.district,
      },
      status: 'QUEUED',
      scheduledAt,
      deduplicationKey: `announcement:${announcement.id}:subscription:${subscription.id}:${announcement.updatedAt?.toISOString() || scheduledAt.toISOString()}`,
    }));

  records.push({
    channel: 'TELEGRAM',
    notificationType: urgent ? 'URGENT_ANNOUNCEMENT' : 'ANNOUNCEMENT',
    referenceType: 'announcement',
    referenceId: announcement.id,
    recipient: env.TELEGRAM_CHANNEL_ID,
    payload: {
      title: announcement.title,
      category: announcement.category,
      summary: announcement.summary,
      content: announcement.content,
      district: announcement.district,
    },
    status: 'QUEUED',
    scheduledAt,
    deduplicationKey: `announcement:${announcement.id}:telegram:${announcement.updatedAt?.toISOString() || scheduledAt.toISOString()}`,
  });
  return notificationsRepository.enqueueMany(records);
}

export async function queueRegistrationConfirmation(registration) {
  if (!registration.email) return 0;
  return notificationsRepository.enqueueMany([{
    channel: 'EMAIL',
    notificationType: 'EVENT_REGISTRATION',
    referenceType: 'event_registration',
    referenceId: registration.id,
    recipient: registration.email,
    payload: {
      notificationType: 'EVENT_REGISTRATION',
      subject: `Registration confirmed: ${registration.event.title}`,
      name: registration.fullName,
      eventTitle: registration.event.title,
      eventDate: registration.event.date.toISOString().slice(0, 10),
      eventTime: registration.event.time,
      eventLocation: registration.event.location,
      passNumber: registration.passNumber,
      attendeesCount: registration.attendeesCount,
    },
    status: 'QUEUED',
    scheduledAt: new Date(),
    deduplicationKey: `event-registration:${registration.id}:confirmed`,
  }]);
}
