import { createHash } from 'node:crypto';
import { prisma } from '../../config/database.js';

export const notificationsRepository = {
  findSubscriptionByToken(manageToken) {
    return prisma.eventNotificationSubscription.findUnique({ where: { manageToken } });
  },

  async findNotificationLog(id) {
    return prisma.notificationLog.findUnique({
      where: { id },
      include: { pushSubscription: true },
    });
  },

  findSubscriptionByEmail(normalizedEmail) {
    return prisma.eventNotificationSubscription.findUnique({ where: { normalizedEmail } });
  },

  findSubscriptionByVerificationToken(emailVerificationToken) {
    return prisma.eventNotificationSubscription.findUnique({ where: { emailVerificationToken } });
  },

  createSubscription(data) {
    return prisma.eventNotificationSubscription.create({ data });
  },

  updateSubscription(id, data) {
    return prisma.eventNotificationSubscription.update({ where: { id }, data });
  },

  deleteSubscription(id) {
    return prisma.eventNotificationSubscription.delete({ where: { id } });
  },

  findMatchingEventSubscriptions() {
    return prisma.eventNotificationSubscription.findMany({
      where: {
        OR: [
          { enableEmail: true, emailVerified: true, email: { not: null } },
          { enableBrowser: true, pushSubscriptions: { some: {} } },
        ],
      },
      include: { pushSubscriptions: true },
    });
  },

  findUpcomingPublishedEvents(fromDate) {
    const startOfDay = new Date(Date.UTC(
      fromDate.getUTCFullYear(),
      fromDate.getUTCMonth(),
      fromDate.getUTCDate()
    ));
    return prisma.councilEvent.findMany({
      where: {
        isPublished: true,
        status: { not: 'Cancelled' },
        date: { gte: startOfDay },
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    });
  },

  findAnnouncementSubscriptions() {
    return prisma.eventNotificationSubscription.findMany({
      where: { enableAnnouncements: true, enableEmail: true, emailVerified: true, email: { not: null } },
    });
  },

  async enqueueMany(records) {
    if (records.length === 0) return 0;
    const result = await prisma.notificationLog.createMany({ data: records, skipDuplicates: true });
    return result.count;
  },

  findDueQueued(limit = 500) {
    return prisma.notificationLog.findMany({
      where: { status: 'QUEUED', scheduledAt: { lte: new Date() } },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { id: true },
    });
  },

  upsertPushSubscription(subscriptionId, data) {
    const endpointHash = createHash('sha256').update(data.endpoint).digest('hex');
    return prisma.webPushSubscription.upsert({
      where: { endpointHash },
      create: { subscriptionId, ...data, endpointHash },
      update: { subscriptionId, ...data },
    });
  },

  findPushSubscriptions(subscriptionId) {
    return prisma.webPushSubscription.findMany({ where: { subscriptionId } });
  },

  findPushSubscriptionById(id) {
    return prisma.webPushSubscription.findUnique({ where: { id } });
  },

  countPushSubscriptions(subscriptionId) {
    return prisma.webPushSubscription.count({ where: { subscriptionId } });
  },

  disableBrowserNotifications(subscriptionId) {
    return prisma.eventNotificationSubscription.update({
      where: { id: subscriptionId },
      data: { enableBrowser: false },
    });
  },

  deletePushSubscription(id) {
    return prisma.webPushSubscription.deleteMany({ where: { id } });
  },

  deletePushSubscriptionByEndpoint(subscriptionId, endpoint) {
    const endpointHash = createHash('sha256').update(endpoint).digest('hex');
    return prisma.webPushSubscription.deleteMany({ where: { subscriptionId, endpointHash } });
  },

  async markEmailVerified(id) {
    return prisma.eventNotificationSubscription.update({
      where: { id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });
  },

  async cancelQueuedForReference(referenceType, referenceId) {
    return prisma.notificationLog.updateMany({
      where: { referenceType, referenceId, status: 'QUEUED' },
      data: { status: 'CANCELLED' },
    });
  },

  async cancelQueuedForSubscription(subscriptionId) {
    return prisma.notificationLog.updateMany({
      where: { subscriptionId, status: 'QUEUED' },
      data: { status: 'CANCELLED' },
    });
  },

  async listLogs({ skip, take, status }) {
    const where = status ? { status } : {};
    const [items, totalItems] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        skip,
        take,
        orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          channel: true,
          notificationType: true,
          referenceType: true,
          referenceId: true,
          status: true,
          scheduledAt: true,
          sentAt: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      prisma.notificationLog.count({ where }),
    ]);
    return { items, totalItems };
  },

  createTelegramGatewayLog(data) {
    return prisma.notificationLog.create({ data });
  },

  updateTelegramGatewayLog(id, data) {
    return prisma.notificationLog.update({ where: { id }, data });
  },

  async listTelegramGatewayLogs({ skip, take, status }) {
    const where = {
      channel: 'TELEGRAM',
      notificationType: 'ADMIN_GATEWAY_BROADCAST',
      ...(status ? { status } : {}),
    };
    const [items, totalItems] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          recipient: true,
          payload: true,
          status: true,
          sentAt: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      prisma.notificationLog.count({ where }),
    ]);
    return { items, totalItems };
  },

  findLogStatus(id) {
    return prisma.notificationLog.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
  },

  requeueFailedLog(id) {
    return prisma.notificationLog.updateMany({
      where: { id, status: 'FAILED' },
      data: { status: 'QUEUED', scheduledAt: new Date(), sentAt: null, errorMessage: null },
    });
  },
};
