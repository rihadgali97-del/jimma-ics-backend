import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendNoContent, sendSuccess } from '../../common/utils/apiResponse.js';
import { ValidationError } from '../../common/errors/httpErrors.js';
import {
  getSubscription,
  getPushConfiguration,
  getTelegramGatewayStatus,
  listTelegramGatewayHistory,
  listNotificationLogs,
  removePushSubscription,
  removeSubscription,
  retryNotificationLog,
  saveSubscription,
  savePushSubscription,
  sendPushTestNotification,
  sendTelegramGatewayBroadcast,
  verifyEmail,
} from './notifications.service.js';
import { notificationManageTokenSchema } from './notifications.validation.js';

function readManageToken(req, _res, next) {
  const result = notificationManageTokenSchema.safeParse(req.get('x-notification-manage-token'));
  if (!result.success) {
    return next(new ValidationError('A valid notification management token is required'));
  }
  req.notificationManageToken = result.data;
  return next();
}

export const getCurrentSubscription = [
  readManageToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, { data: await getSubscription(req.notificationManageToken) });
  }),
];

export const getPushConfig = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: getPushConfiguration() });
});

export const getTelegramStatus = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: getTelegramGatewayStatus() });
});

export const getTelegramHistory = asyncHandler(async (req, res) => {
  const result = await listTelegramGatewayHistory(req.query);
  sendSuccess(res, { data: result });
});

export const sendTelegramBroadcast = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await sendTelegramGatewayBroadcast(req.body), statusCode: 201 });
});

export const retryLog = asyncHandler(async (req, res) => {
  const result = await retryNotificationLog(req.params.id);
  const { scheduleNotification } = await import('../../jobs/queues/index.js');
  await scheduleNotification(Number(result.id));
  sendSuccess(res, { data: result });
});

export const verifyEmailAddress = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await verifyEmail(req.body.token) });
});

export const saveCurrentSubscription = asyncHandler(async (req, res) => {
  const result = await saveSubscription(req.body, req.get('x-notification-manage-token'));
  sendSuccess(res, { data: result, statusCode: result.created ? 201 : 200 });
});

export const saveCurrentPushSubscription = [
  readManageToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, {
      data: await savePushSubscription(req.notificationManageToken, req.body),
      statusCode: 201,
    });
  }),
];

export const sendCurrentPushTestNotification = [
  readManageToken,
  asyncHandler(async (req, res) => {
    sendSuccess(res, {
      data: await sendPushTestNotification(req.notificationManageToken, req.body.endpoint),
    });
  }),
];

export const removeCurrentPushSubscription = [
  readManageToken,
  asyncHandler(async (req, res) => {
    await removePushSubscription(req.notificationManageToken, req.body.endpoint);
    sendNoContent(res);
  }),
];

export const removeCurrentSubscription = [
  readManageToken,
  asyncHandler(async (req, res) => {
    await removeSubscription(req.notificationManageToken);
    sendNoContent(res);
  }),
];

export const listLogs = asyncHandler(async (req, res) => {
  const result = await listNotificationLogs(req.query);
  sendSuccess(res, { data: result.items, meta: result.meta });
});
