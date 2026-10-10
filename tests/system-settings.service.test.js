import { jest } from '@jest/globals';

const mockPrisma = { $queryRaw: jest.fn() };
const mockLogger = { warn: jest.fn() };

jest.unstable_mockModule('../src/config/database.js', () => ({ prisma: mockPrisma }));
jest.unstable_mockModule('../src/common/utils/logger.js', () => ({ logger: mockLogger }));

const { env } = await import('../src/config/env.js');
const { getSystemSettingsStatus } = await import('../src/modules/system-settings/system-settings.service.js');

describe('System settings status', () => {
  const originalValues = {
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
    GMAIL_SMTP_USER: env.GMAIL_SMTP_USER,
    GMAIL_APP_PASSWORD: env.GMAIL_APP_PASSWORD,
    GMAIL_CLIENT_ID: env.GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET: env.GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN: env.GMAIL_REFRESH_TOKEN,
    GMAIL_OAUTH2_USER: env.GMAIL_OAUTH2_USER,
    CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET,
    VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);
    Object.assign(env, {
      TELEGRAM_BOT_TOKEN: 'secret-telegram-token',
      GMAIL_SMTP_USER: 'council@example.org',
      GMAIL_APP_PASSWORD: 'secret-email-password',
      GMAIL_CLIENT_ID: undefined,
      GMAIL_CLIENT_SECRET: undefined,
      GMAIL_REFRESH_TOKEN: undefined,
      GMAIL_OAUTH2_USER: undefined,
      CLOUDINARY_CLOUD_NAME: 'council-cloud',
      CLOUDINARY_API_KEY: 'secret-cloud-key',
      CLOUDINARY_API_SECRET: 'secret-cloud-secret',
      VAPID_PUBLIC_KEY: 'public-key',
      VAPID_PRIVATE_KEY: 'secret-vapid-key',
    });
  });

  afterAll(() => {
    Object.assign(env, originalValues);
  });

  it('reports database and integration readiness without exposing credentials', async () => {
    const status = await getSystemSettingsStatus();

    expect(status.database).toBe('connected');
    expect(status.integrations).toEqual({
      telegram: true,
      email: true,
      cloudinary: true,
      browserNotifications: true,
    });
    expect(JSON.stringify(status)).not.toContain('secret-');
    expect(status.checkedAt).toEqual(expect.any(String));
  });

  it('reports an unavailable database and missing integration setup', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('connection failed'));
    env.TELEGRAM_BOT_TOKEN = undefined;
    env.GMAIL_APP_PASSWORD = undefined;
    env.CLOUDINARY_API_SECRET = undefined;
    env.VAPID_PRIVATE_KEY = undefined;

    const status = await getSystemSettingsStatus();

    expect(status.database).toBe('unavailable');
    expect(status.integrations).toEqual({
      telegram: false,
      email: false,
      cloudinary: false,
      browserNotifications: false,
    });
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });

  it('reports Gmail API configuration as ready without SMTP credentials', async () => {
    env.GMAIL_SMTP_USER = undefined;
    env.GMAIL_APP_PASSWORD = undefined;
    env.GMAIL_CLIENT_ID = 'client-id';
    env.GMAIL_CLIENT_SECRET = 'client-secret';
    env.GMAIL_REFRESH_TOKEN = 'refresh-token';
    env.GMAIL_OAUTH2_USER = 'council@gmail.com';

    const status = await getSystemSettingsStatus();

    expect(status.integrations.email).toBe(true);
  });
});
