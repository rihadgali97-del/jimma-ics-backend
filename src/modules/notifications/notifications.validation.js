import { idParamSchema, z } from '../../common/validation/shared.js';

const reminderTimings = ['instant', '24h_before', '48h_before', 'weekly_digest'];
const subscriptionFields = {
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  name: z.string().trim().min(1).max(180).default('Community Member'),
  enableEmail: z.boolean().default(false),
  enableBrowser: z.boolean().default(false),
  enableAnnouncements: z.boolean().default(false),
  categories: z.array(z.string().trim().min(1).max(80)).max(20).default(['All']),
  districts: z.array(z.string().trim().min(1).max(150)).max(30).default(['All']),
  reminderTiming: z.enum(reminderTimings).default('24h_before'),
  specificEventIds: z.array(z.string().trim().min(1).max(64)).max(100).default([]),
};

const preferencesSchema = z.object(subscriptionFields).superRefine((data, context) => {
  if ((data.enableEmail || data.enableAnnouncements) && !data.email) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['email'],
      message: 'An email address is required when email notifications are enabled',
    });
  }
  if (!data.enableEmail && !data.enableBrowser && !data.enableAnnouncements) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enable at least one notification preference',
    });
  }
});

export const saveSubscriptionSchema = z.object({
  body: preferencesSchema,
});

export const notificationManageTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const verifyEmailSchema = z.object({
  body: z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }),
});

export const pushSubscriptionSchema = z.object({
  body: z.object({
    endpoint: z.string().url().max(2048).refine((value) => new globalThis.URL(value).protocol === 'https:', {
      message: 'Push endpoint must use HTTPS',
    }),
    keys: z.object({
      p256dh: z.string().min(20).max(255),
      auth: z.string().min(10).max(255),
    }),
  }),
});

export const removePushSubscriptionSchema = z.object({
  body: z.object({
    endpoint: z.string().url().max(2048).refine((value) => new globalThis.URL(value).protocol === 'https:', {
      message: 'Push endpoint must use HTTPS',
    }),
  }),
});

export const listNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
    status: z.enum(['QUEUED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED']).optional(),
  }),
});

export const notificationLogIdSchema = z.object({ params: idParamSchema });

export const telegramBroadcastSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(180),
    content: z.string().trim().min(1).max(3600),
    category: z.enum([
      'janazah_broadcast',
      'prayer_announcement',
      'moon_sighting',
      'khutbah_advisory',
      'general_bulletin',
    ]),
  }).superRefine((data, context) => {
    if (data.title.length + data.content.length + 2 > 3800) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['content'],
        message: 'Telegram title and message must not exceed 3800 characters combined',
      });
    }
  }),
});
