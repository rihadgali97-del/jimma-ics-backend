import { jest } from '@jest/globals';
import nodemailer from 'nodemailer';
import { env } from '../src/config/env.js';
import { dispatch } from '../src/common/services/notifications/dispatch.js';
import { sendEmail } from '../src/common/services/notifications/providers/email.provider.js';
import { sendTelegram } from '../src/common/services/notifications/providers/telegram.provider.js';
import { sendPush } from '../src/common/services/notifications/providers/push.provider.js';
import { telegramBroadcastSchema } from '../src/modules/notifications/notifications.validation.js';

describe('Notification delivery providers', () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    GMAIL_SMTP_USER: env.GMAIL_SMTP_USER,
    GMAIL_APP_PASSWORD: env.GMAIL_APP_PASSWORD,
    GMAIL_CLIENT_ID: env.GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET: env.GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN: env.GMAIL_REFRESH_TOKEN,
    GMAIL_OAUTH2_USER: env.GMAIL_OAUTH2_USER,
    EMAIL_FROM_ADDRESS: env.EMAIL_FROM_ADDRESS,
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHANNEL_ID: env.TELEGRAM_CHANNEL_ID,
    VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY,
  };

  afterEach(() => {
    global.fetch = originalFetch;
    Object.assign(env, originalEnv);
    jest.restoreAllMocks();
  });

  it('sends email through Gmail SMTP and includes escaped content', async () => {
    env.GMAIL_SMTP_USER = 'sender@gmail.com';
    env.GMAIL_APP_PASSWORD = 'test app password';
    env.GMAIL_CLIENT_ID = undefined;
    env.GMAIL_CLIENT_SECRET = undefined;
    env.GMAIL_REFRESH_TOKEN = undefined;
    env.GMAIL_OAUTH2_USER = undefined;
    env.EMAIL_FROM_ADDRESS = 'Jimma Council <alerts@example.org>';
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'test-message' });
    const close = jest.fn();
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail, close });

    const result = await sendEmail('person@example.org', { subject: 'Notice', title: '<unsafe>' });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: 'sender@gmail.com', pass: 'testapppassword' },
    }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'person@example.org',
      subject: 'Notice',
      html: expect.stringContaining('&lt;unsafe&gt;'),
    }));
    expect(close).toHaveBeenCalled();
    expect(result).toEqual({ messageId: 'test-message' });
  });

  it('emails event registrants an inline and downloadable QR pass', async () => {
    env.GMAIL_SMTP_USER = 'sender@gmail.com';
    env.GMAIL_APP_PASSWORD = 'test app password';
    env.GMAIL_CLIENT_ID = undefined;
    env.GMAIL_CLIENT_SECRET = undefined;
    env.GMAIL_REFRESH_TOKEN = undefined;
    env.GMAIL_OAUTH2_USER = undefined;
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'event-pass-message' });
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail, close: jest.fn() });

    await sendEmail('attendee@example.org', {
      notificationType: 'EVENT_REGISTRATION',
      subject: 'Registration confirmed: Community Lecture',
      name: 'Amina Ahmed',
      eventTitle: 'Community Lecture',
      eventDate: '2026-11-10',
      eventTime: '09:00',
      eventLocation: 'Jimma Mosque',
      passNumber: 'JIC-PASS-2026-ABC1234567',
      attendeesCount: 2,
    });

    const mail = sendMail.mock.calls[0][0];
    expect(mail.html).toContain('cid:event-pass-qr');
    expect(mail.html).toContain('href="cid:event-pass-qr"');
    expect(mail.html).toContain('Download QR pass');
    expect(mail.html).toContain('Community Lecture');
    expect(mail.text).toContain('downloadable QR pass is attached as a PNG');
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments[0]).toMatchObject({
      filename: 'Event-Pass-JIC-PASS-2026-ABC1234567.png',
      contentType: 'image/png',
      cid: 'event-pass-qr',
      contentDisposition: 'inline',
    });
    expect(mail.attachments[0].content.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
  }, 10_000);

  it('sends through the Gmail API over HTTPS when OAuth credentials are configured', async () => {
    env.GMAIL_SMTP_USER = 'sender@gmail.com';
    env.GMAIL_CLIENT_ID = 'client-id';
    env.GMAIL_CLIENT_SECRET = 'client-secret';
    env.GMAIL_REFRESH_TOKEN = 'refresh-token';
    env.GMAIL_OAUTH2_USER = 'sender@gmail.com';
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'short-lived-access-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'gmail-api-message' }),
      });

    const result = await sendEmail('person@example.org', { title: 'OAuth message' });

    expect(global.fetch).toHaveBeenNthCalledWith(1, 'https://oauth2.googleapis.com/token', expect.objectContaining({
      method: 'POST',
      body: expect.any(URLSearchParams),
    }));
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer short-lived-access-token' }),
    }));
    const request = JSON.parse(global.fetch.mock.calls[1][1].body);
    const rawMessage = Buffer.from(request.raw, 'base64url').toString();
    expect(rawMessage).toContain('To: person@example.org');
    expect(rawMessage).toContain(Buffer.from('OAuth message').toString('base64'));
    expect(result).toEqual({ messageId: 'gmail-api-message' });
  });

  it('sends Telegram messages to the configured information channel', async () => {
    env.TELEGRAM_BOT_TOKEN = 'test-token';
    env.TELEGRAM_CHANNEL_ID = '@riho_information';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 42 } }),
    });

    const result = await sendTelegram('@some-other-channel', { title: 'Public event' });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      expect.objectContaining({
        body: expect.stringContaining('"chat_id":"@riho_information"'),
      })
    );
    expect(result).toEqual({ messageId: '42' });
  });

  it('returns an actionable upstream error when the bot is not a channel member', async () => {
    env.TELEGRAM_BOT_TOKEN = 'test-token';
    env.TELEGRAM_CHANNEL_ID = '@riho_information';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        ok: false,
        description: 'Forbidden: bot is not a member of the channel chat',
      }),
    });

    await expect(sendTelegram('@riho_information', { title: 'Public event' })).rejects.toMatchObject({
      statusCode: 502,
      code: 'UPSTREAM_SERVICE_ERROR',
      message: expect.stringContaining('Add the bot as a channel administrator'),
    });
  });

  it('validates Telegram broadcast size before contacting the provider', () => {
    expect(telegramBroadcastSchema.safeParse({
      body: { title: 'Announcement', content: 'Public notice', category: 'general_bulletin' },
    }).success).toBe(true);
    expect(telegramBroadcastSchema.safeParse({
      body: { title: 'Announcement', content: 'x'.repeat(3601), category: 'general_bulletin' },
    }).success).toBe(false);
    expect(telegramBroadcastSchema.safeParse({
      body: { title: 'Student report', content: 'Private report', category: 'sabaq_alert' },
    }).success).toBe(false);
  });

  it('fails explicitly when provider credentials are absent', async () => {
    env.GMAIL_SMTP_USER = undefined;
    env.GMAIL_APP_PASSWORD = undefined;
    env.GMAIL_CLIENT_ID = undefined;
    env.GMAIL_CLIENT_SECRET = undefined;
    env.GMAIL_REFRESH_TOKEN = undefined;
    env.GMAIL_OAUTH2_USER = undefined;
    env.EMAIL_FROM_ADDRESS = undefined;
    env.TELEGRAM_BOT_TOKEN = undefined;
    env.VAPID_PUBLIC_KEY = undefined;
    env.VAPID_PRIVATE_KEY = undefined;

    await expect(sendEmail('person@example.org', { title: 'Notice' }))
      .rejects.toThrow('GMAIL_SMTP_USER');
    await expect(sendTelegram('@riho_information', { title: 'Notice' }))
      .rejects.toThrow('TELEGRAM_BOT_TOKEN');
    await expect(sendPush(null, { title: 'Notice' }))
      .rejects.toThrow('VAPID_PUBLIC_KEY');
    await expect(dispatch('SMS', '1234567', 'No SMS'))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
