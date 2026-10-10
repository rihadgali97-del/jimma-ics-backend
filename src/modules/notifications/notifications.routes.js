import { Router } from 'express';
import * as notificationsController from './notifications.controller.js';
import {
  listNotificationsSchema,
  notificationLogIdSchema,
  pushSubscriptionSchema,
  removePushSubscriptionSchema,
  saveSubscriptionSchema,
  telegramBroadcastSchema,
  verifyEmailSchema,
} from './notifications.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorizeAny } from '../../common/middlewares/authorize.js';
import { strictRateLimiter } from '../../common/middlewares/rateLimiter.js';

export const notificationsPublicRouter = Router();
export const notificationsAdminRouter = Router();

notificationsPublicRouter.get('/push/config', notificationsController.getPushConfig);
notificationsPublicRouter.post(
  '/verify-email',
  strictRateLimiter({ windowMs: 60 * 60 * 1000, max: 12 }),
  validate(verifyEmailSchema),
  notificationsController.verifyEmailAddress
);
notificationsPublicRouter.get('/subscriptions/current', notificationsController.getCurrentSubscription);
notificationsPublicRouter.post(
  '/subscriptions',
  strictRateLimiter({ windowMs: 60 * 60 * 1000, max: 12 }),
  validate(saveSubscriptionSchema),
  notificationsController.saveCurrentSubscription
);
notificationsPublicRouter.delete('/subscriptions/current', notificationsController.removeCurrentSubscription);
notificationsPublicRouter.post(
  '/subscriptions/current/push',
  validate(pushSubscriptionSchema),
  notificationsController.saveCurrentPushSubscription
);
notificationsPublicRouter.post(
  '/subscriptions/current/push/test',
  strictRateLimiter({ windowMs: 60 * 60 * 1000, max: 3 }),
  validate(removePushSubscriptionSchema),
  notificationsController.sendCurrentPushTestNotification
);
notificationsPublicRouter.delete(
  '/subscriptions/current/push',
  validate(removePushSubscriptionSchema),
  notificationsController.removeCurrentPushSubscription
);

notificationsAdminRouter.use(
  authenticate,
  authorizeAny('events.write', 'announcements.write')
);
notificationsAdminRouter.get('/', validate(listNotificationsSchema), notificationsController.listLogs);
notificationsAdminRouter.get('/telegram/status', notificationsController.getTelegramStatus);
notificationsAdminRouter.get(
  '/telegram/history',
  validate(listNotificationsSchema),
  notificationsController.getTelegramHistory
);
notificationsAdminRouter.post(
  '/telegram',
  strictRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }),
  validate(telegramBroadcastSchema),
  notificationsController.sendTelegramBroadcast
);
notificationsAdminRouter.post(
  '/:id/retry',
  validate(notificationLogIdSchema),
  notificationsController.retryLog
);
