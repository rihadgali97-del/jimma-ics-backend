import { jest } from '@jest/globals';

const sendTelegramMock = jest.fn();
const mockRepository = {
  findSubscriptionByToken: jest.fn(),
  findSubscriptionByEmail: jest.fn(),
  findSubscriptionByVerificationToken: jest.fn(),
  createSubscription: jest.fn(),
  updateSubscription: jest.fn(),
  deleteSubscription: jest.fn(),
  findMatchingEventSubscriptions: jest.fn(),
  findUpcomingPublishedEvents: jest.fn(),
  findAnnouncementSubscriptions: jest.fn(),
  enqueueMany: jest.fn(),
  cancelQueuedForReference: jest.fn(),
  cancelQueuedForSubscription: jest.fn(),
  markEmailVerified: jest.fn(),
  upsertPushSubscription: jest.fn(),
  deletePushSubscriptionByEndpoint: jest.fn(),
  findLogStatus: jest.fn(),
  requeueFailedLog: jest.fn(),
  listLogs: jest.fn(),
  createTelegramGatewayLog: jest.fn(),
  updateTelegramGatewayLog: jest.fn(),
  listTelegramGatewayLogs: jest.fn(),
};

jest.unstable_mockModule('../src/modules/notifications/notifications.repository.js', () => ({
  notificationsRepository: mockRepository,
}));
jest.unstable_mockModule('../src/common/services/notifications/providers/telegram.provider.js', () => ({
  sendTelegram: sendTelegramMock,
}));

const service = await import('../src/modules/notifications/notifications.service.js');
const { saveSubscriptionSchema } = await import('../src/modules/notifications/notifications.validation.js');
const { env } = await import('../src/config/env.js');

beforeEach(() => {
  jest.clearAllMocks();
  env.TELEGRAM_CHANNEL_ID = '@riho_information';
  mockRepository.findUpcomingPublishedEvents.mockResolvedValue([]);
});

describe('Notification subscription service', () => {
  const subscriptionData = {
    email: 'Community@example.com',
    name: 'Community Member',
    enableEmail: true,
    enableBrowser: false,
    enableAnnouncements: true,
    categories: ['Lecture'],
    districts: ['Jimma'],
    reminderTiming: '24h_before',
    specificEventIds: [],
  };

  it('creates a persisted subscription with a private management token', async () => {
    mockRepository.findSubscriptionByEmail.mockResolvedValue(null);
    mockRepository.createSubscription.mockImplementation(async (data) => ({
      id: 5,
      ...data,
      subscribedAt: new Date('2026-10-04T00:00:00.000Z'),
    }));

    const result = await service.saveSubscription(subscriptionData);

    expect(result).toMatchObject({
      id: '5',
      email: 'Community@example.com',
      manageToken: expect.stringMatching(/^[a-f0-9]{64}$/),
      created: true,
    });
    expect(mockRepository.createSubscription).toHaveBeenCalledWith(expect.objectContaining({
      normalizedEmail: 'community@example.com',
      reminderTiming: '24h_before',
    }));
    expect(result.emailVerificationToken).toBeUndefined();
    expect(mockRepository.enqueueMany).toHaveBeenCalledWith([
      expect.objectContaining({
        notificationType: 'EMAIL_VERIFICATION',
        recipient: 'Community@example.com',
        payload: expect.objectContaining({
          verificationUrl: expect.stringContaining('notificationVerification='),
        }),
      }),
    ]);
  });

  it('does not allow another browser to claim an existing email subscription', async () => {
    mockRepository.findSubscriptionByEmail.mockResolvedValue({ id: 9 });

    await expect(service.saveSubscription(subscriptionData))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(mockRepository.createSubscription).not.toHaveBeenCalled();
  });

  it('validates that enabled email channels have an address', () => {
    const result = saveSubscriptionSchema.safeParse({
      body: { ...subscriptionData, email: '' },
    });
    expect(result.success).toBe(false);
  });

  it('verifies only a matching unexpired email token', async () => {
    mockRepository.findSubscriptionByVerificationToken.mockResolvedValue({
      id: 5,
      email: 'community@example.com',
      emailVerified: false,
      emailVerificationExpiresAt: new Date(Date.now() + 60_000),
      subscribedAt: new Date('2026-10-04T00:00:00.000Z'),
    });
    mockRepository.markEmailVerified.mockResolvedValue({
      id: 5,
      email: 'community@example.com',
      emailVerified: true,
      subscribedAt: new Date('2026-10-04T00:00:00.000Z'),
    });

    await expect(service.verifyEmail('a'.repeat(64))).resolves.toMatchObject({
      id: '5',
      emailVerified: true,
    });
  });

  it('queues matching upcoming event alerts after email verification', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-10T00:00:00.000Z'));
    const event = {
      id: 18,
      title: 'Community Lecture',
      category: 'Lecture',
      date: new Date('2026-10-12T00:00:00.000Z'),
      time: '09:00',
      location: 'Jimma Mosque',
      district: 'Jimma',
      description: 'A community lecture.',
      isPublished: true,
      status: 'Upcoming',
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    };
    mockRepository.findSubscriptionByVerificationToken.mockResolvedValue({
      id: 5,
      email: 'community@example.com',
      emailVerified: false,
      emailVerificationExpiresAt: new Date('2026-10-11T00:00:00.000Z'),
    });
    mockRepository.markEmailVerified.mockResolvedValue({
      id: 5,
      email: 'community@example.com',
      emailVerified: true,
      subscribedAt: new Date('2026-10-04T00:00:00.000Z'),
    });
    mockRepository.findUpcomingPublishedEvents.mockResolvedValue([event]);
    mockRepository.findMatchingEventSubscriptions.mockResolvedValue([{
      id: 5,
      email: 'community@example.com',
      emailVerified: true,
      enableEmail: true,
      enableBrowser: false,
      categories: ['Lecture'],
      districts: ['Jimma'],
      specificEventIds: ['18'],
      reminderTiming: '24h_before',
      pushSubscriptions: [],
    }]);
    mockRepository.enqueueMany.mockResolvedValue(2);

    await service.verifyEmail('a'.repeat(64));

    const queuedRecords = mockRepository.enqueueMany.mock.calls[0][0];
    expect(queuedRecords).toContainEqual(expect.objectContaining({
      channel: 'EMAIL',
      recipient: 'community@example.com',
      notificationType: 'EVENT_REMINDER',
      referenceId: 18,
      scheduledAt: new Date('2026-10-11T06:00:00.000Z'),
    }));
    jest.useRealTimers();
  });

  it('rejects expired verification tokens', async () => {
    mockRepository.findSubscriptionByVerificationToken.mockResolvedValue({
      id: 5,
      emailVerificationExpiresAt: new Date(Date.now() - 1),
    });
    await expect(service.verifyEmail('a'.repeat(64))).rejects.toMatchObject({ statusCode: 404 });
    expect(mockRepository.markEmailVerified).not.toHaveBeenCalled();
  });

  it('allows retrying only failed notification log entries', async () => {
    mockRepository.findLogStatus.mockResolvedValue({ id: 27, status: 'FAILED' });
    mockRepository.requeueFailedLog.mockResolvedValue({ count: 1 });
    await expect(service.retryNotificationLog(27)).resolves.toEqual({ id: '27', status: 'QUEUED' });
    expect(mockRepository.requeueFailedLog).toHaveBeenCalledWith(27);
  });

  it('rejects retrying a notification that is not failed', async () => {
    mockRepository.findLogStatus.mockResolvedValue({ id: 27, status: 'SENT' });
    await expect(service.retryNotificationLog(27)).rejects.toMatchObject({ statusCode: 409 });
    expect(mockRepository.requeueFailedLog).not.toHaveBeenCalled();
  });
});

describe('Telegram gateway history', () => {
  it('persists a Telegram send attempt and marks it sent after provider acceptance', async () => {
    mockRepository.createTelegramGatewayLog.mockResolvedValue({ id: 91 });
    mockRepository.updateTelegramGatewayLog.mockResolvedValue({});
    sendTelegramMock.mockResolvedValue({ messageId: '456' });

    await expect(service.sendTelegramGatewayBroadcast({
      title: 'Public notice',
      content: 'Community announcement',
      category: 'general_bulletin',
    })).resolves.toEqual({
      id: '91',
      channelId: '@riho_information',
      messageId: '456',
    });

    expect(mockRepository.createTelegramGatewayLog).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'TELEGRAM',
      notificationType: 'ADMIN_GATEWAY_BROADCAST',
      status: 'SENDING',
      recipient: '@riho_information',
      payload: {
        title: 'Public notice',
        content: 'Community announcement',
        category: 'general_bulletin',
      },
    }));
    expect(mockRepository.updateTelegramGatewayLog).toHaveBeenCalledWith(91, expect.objectContaining({
      status: 'SENT',
      payload: expect.objectContaining({ messageId: '456' }),
    }));
  });

  it('records failed Telegram attempts before returning the provider error', async () => {
    mockRepository.createTelegramGatewayLog.mockResolvedValue({ id: 92 });
    mockRepository.updateTelegramGatewayLog.mockResolvedValue({});
    sendTelegramMock.mockRejectedValue(new Error('Channel is unavailable'));

    await expect(service.sendTelegramGatewayBroadcast({
      title: 'Public notice',
      content: 'Community announcement',
      category: 'general_bulletin',
    })).rejects.toThrow('Channel is unavailable');

    expect(mockRepository.updateTelegramGatewayLog).toHaveBeenCalledWith(92, {
      status: 'FAILED',
      errorMessage: 'Channel is unavailable',
    });
  });

  it('returns paginated Telegram broadcast history with delivery details', async () => {
    mockRepository.listTelegramGatewayLogs.mockResolvedValue({
      items: [{
        id: 17,
        recipient: '@riho_information',
        payload: { title: 'Notice', content: 'Details', category: 'general_bulletin', messageId: '88' },
        status: 'SENT',
        sentAt: new Date('2026-10-04T10:00:00.000Z'),
        errorMessage: null,
        createdAt: new Date('2026-10-04T09:59:00.000Z'),
      }],
      totalItems: 31,
    });

    await expect(service.listTelegramGatewayHistory({ page: '2', pageSize: '25' })).resolves.toEqual({
      items: [{
        id: '17',
        title: 'Notice',
        category: 'general_bulletin',
        content: 'Details',
        messageId: '88',
        channelId: '@riho_information',
        status: 'SENT',
        sentAt: '2026-10-04T10:00:00.000Z',
        errorMessage: null,
        createdAt: '2026-10-04T09:59:00.000Z',
      }],
      meta: { page: 2, pageSize: 25, totalItems: 31, totalPages: 2 },
    });
    expect(mockRepository.listTelegramGatewayLogs).toHaveBeenCalledWith({
      skip: 25,
      take: 25,
      status: undefined,
    });
  });
});

describe('Notification outbox triggers', () => {
  const subscription = {
    id: 3,
    email: 'community@example.com',
    emailVerified: true,
    enableEmail: true,
    enableBrowser: false,
    categories: ['Lecture'],
    districts: ['Jimma'],
    specificEventIds: [],
    reminderTiming: '24h_before',
    pushSubscriptions: [],
  };
  const event = {
    id: 18,
    title: 'Community Lecture',
    category: 'Lecture',
    date: new Date('2026-10-10T00:00:00.000Z'),
    time: '09:00',
    location: 'Jimma Mosque',
    district: 'Jimma',
    description: 'A community lecture.',
    isPublished: true,
    status: 'Upcoming',
  };

  it('queues a filtered event reminder at the selected lead time', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T00:00:00.000Z'));
    mockRepository.findMatchingEventSubscriptions.mockResolvedValue([subscription]);
    mockRepository.enqueueMany.mockResolvedValue(1);

    await expect(service.queueEventNotifications(event)).resolves.toBe(1);

    const [record] = mockRepository.enqueueMany.mock.calls[0][0];
    expect(record).toMatchObject({
      recipient: 'community@example.com',
      notificationType: 'EVENT_REMINDER',
      status: 'QUEUED',
      deduplicationKey: expect.stringContaining('event:18:subscription:3'),
    });
    expect(record.scheduledAt.toISOString()).toBe('2026-10-09T06:00:00.000Z');
    jest.useRealTimers();
  });

  it('uses the upcoming Friday morning in Jimma time for weekly digests', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-09T03:00:00.000Z'));
    mockRepository.findMatchingEventSubscriptions.mockResolvedValue([
      { ...subscription, reminderTiming: 'weekly_digest' },
    ]);
    mockRepository.enqueueMany.mockResolvedValue(1);

    await service.queueEventNotifications(event);

    expect(mockRepository.enqueueMany.mock.calls[0][0][0].scheduledAt.toISOString())
      .toBe('2026-10-09T05:00:00.000Z');
    jest.useRealTimers();
  });

  it('queues urgent published announcements only for opted-in subscribers', async () => {
    mockRepository.findAnnouncementSubscriptions.mockResolvedValue([subscription]);
    mockRepository.enqueueMany.mockResolvedValue(1);

    await expect(service.queueAnnouncementNotifications({
      id: 7,
      title: 'Urgent Notice',
      category: 'Official Communique',
      summary: 'Please read.',
      content: 'Full notice.',
      district: 'Jimma',
      isUrgent: true,
      isPublished: true,
    })).resolves.toBe(1);

    expect(mockRepository.enqueueMany.mock.calls[0][0][0]).toMatchObject({
      notificationType: 'URGENT_ANNOUNCEMENT',
      status: 'QUEUED',
    });
  });

  it('does not queue unpublished announcements and still broadcasts published announcements to Telegram', async () => {
    await expect(service.queueAnnouncementNotifications({
      id: 7, isPublished: false, isUrgent: true, priority: 'High',
    })).resolves.toBe(0);
    await expect(service.queueAnnouncementNotifications({
      id: 7, isPublished: true, isUrgent: false, priority: 'Normal',
    })).resolves.toBe(1);
    expect(mockRepository.findAnnouncementSubscriptions).not.toHaveBeenCalled();
    expect(mockRepository.enqueueMany.mock.calls[0][0][0]).toMatchObject({
      channel: 'TELEGRAM',
      notificationType: 'ANNOUNCEMENT',
    });
  });

  it('queues a confirmation containing the downloadable pass details for the applicant email', async () => {
    mockRepository.enqueueMany.mockResolvedValue(1);
    const registration = {
      id: 81,
      email: 'amina@example.com',
      fullName: 'Amina Ahmed',
      passNumber: 'JIC-PASS-2026-ABC1234567',
      attendeesCount: 2,
      event: {
        id: 18,
        title: 'Community Lecture',
        date: new Date('2026-11-10T00:00:00.000Z'),
        time: '09:00',
        location: 'Jimma Mosque',
      },
    };

    await expect(service.queueRegistrationConfirmation(registration)).resolves.toBe(1);

    expect(mockRepository.enqueueMany).toHaveBeenCalledWith([
      expect.objectContaining({
        channel: 'EMAIL',
        notificationType: 'EVENT_REGISTRATION',
        recipient: 'amina@example.com',
        payload: expect.objectContaining({
          notificationType: 'EVENT_REGISTRATION',
          name: 'Amina Ahmed',
          eventTitle: 'Community Lecture',
          passNumber: 'JIC-PASS-2026-ABC1234567',
          attendeesCount: 2,
        }),
      }),
    ]);
  });

  it('does not queue an event confirmation when the applicant omitted email', async () => {
    await expect(service.queueRegistrationConfirmation({ email: null })).resolves.toBe(0);
    expect(mockRepository.enqueueMany).not.toHaveBeenCalled();
  });
});
