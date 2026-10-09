import * as eventsService from './events.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/apiResponse.js';

export const listPublic = asyncHandler(async (req, res) => {
  const result = await eventsService.listEvents(req.query, { publicOnly: true });
  sendSuccess(res, { data: result.items, meta: result.meta });
});

export const getPublic = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await eventsService.getEvent(req.params.id, { publicOnly: true }) });
});

export const register = asyncHandler(async (req, res) => {
  sendCreated(res, await eventsService.registerForEvent(req.params.id, req.body, req.file));
});

export const findMyRegistrations = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await eventsService.findMyEventRegistrations(req.body) });
});

export const listAdmin = asyncHandler(async (req, res) => {
  const result = await eventsService.listEvents(req.query, { publicOnly: false });
  sendSuccess(res, { data: result.items, meta: result.meta });
});

export const getAdmin = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await eventsService.getEvent(req.params.id, { publicOnly: false }) });
});

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await eventsService.createEvent(req.body, req.user.id));
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await eventsService.updateEvent(req.params.id, req.body, req.user.id) });
});

export const remove = asyncHandler(async (req, res) => {
  await eventsService.deleteEvent(req.params.id, req.user.id);
  sendNoContent(res);
});

export const listRegistrations = asyncHandler(async (req, res) => {
  const result = await eventsService.listEventRegistrations(req.query);
  sendSuccess(res, { data: result.items, meta: result.meta });
});

export const updateRegistration = asyncHandler(async (req, res) => {
  const registration = await eventsService.updateRegistrationStatus(req.params.id, req.body.status, req.user.id);
  sendSuccess(res, { data: registration });
});

export const reviewPayment = asyncHandler(async (req, res) => {
  const registration = await eventsService.reviewEventPayment(
    req.params.id,
    req.body.paymentStatus,
    req.user.id
  );
  sendSuccess(res, { data: registration });
});

export const getPaymentReceipt = asyncHandler(async (req, res, next) => {
  const receipt = await eventsService.getEventPaymentReceipt(req.params.id);
  res.type(receipt.mimeType);
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(receipt.path, (error) => {
    if (error) next(error);
  });
});
