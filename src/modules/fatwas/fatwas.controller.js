import * as fatwasService from './fatwas.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../common/utils/apiResponse.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await fatwasService.listFatwas(req.query, { publicOnly: true });
  sendSuccess(res, { data: items, meta });
});

export const getById = asyncHandler(async (req, res) => {
  const fatwa = await fatwasService.getFatwa(req.params.id, req.query.locale, {
    publicOnly: true,
  });
  sendSuccess(res, { data: fatwa });
});

// --- Admin ---

export const adminList = asyncHandler(async (req, res) => {
  const { items, meta } = await fatwasService.listFatwas(req.query, { publicOnly: false });
  sendSuccess(res, { data: items, meta });
});

export const adminGetById = asyncHandler(async (req, res) => {
  const fatwa = await fatwasService.getFatwa(req.params.id, req.query.locale, {
    publicOnly: false,
  });
  sendSuccess(res, { data: fatwa });
});

export const create = asyncHandler(async (req, res) => {
  const fatwa = await fatwasService.createFatwa(req.body, req.user.id);
  sendCreated(res, fatwa);
});

export const update = asyncHandler(async (req, res) => {
  const fatwa = await fatwasService.updateFatwa(req.params.id, req.body, req.user.id);
  sendSuccess(res, { data: fatwa });
});

export const remove = asyncHandler(async (req, res) => {
  await fatwasService.deleteFatwa(req.params.id, req.user.id);
  sendNoContent(res);
});