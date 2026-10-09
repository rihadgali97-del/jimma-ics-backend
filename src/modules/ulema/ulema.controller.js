import * as ulemaService from './ulema.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/apiResponse.js';

export const listPublic = asyncHandler(async (req, res) => {
  const { items, meta } = await ulemaService.listUlema(req.query, { publicOnly: true });
  sendSuccess(res, { data: items, meta });
});

export const getPublic = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await ulemaService.getUlemaProfile(req.params.id, { publicOnly: true }) });
});

export const listAdmin = asyncHandler(async (req, res) => {
  const { items, meta } = await ulemaService.listUlema(req.query, { publicOnly: false });
  sendSuccess(res, { data: items, meta });
});

export const getAdmin = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await ulemaService.getUlemaProfile(req.params.id, { publicOnly: false }) });
});

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await ulemaService.createUlemaProfile(req.body, req.user.id, req.ip));
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await ulemaService.updateUlemaProfile(req.params.id, req.body, req.user.id, req.ip) });
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await ulemaService.uploadUlemaAvatar(req.params.id, req.file, req.user.id, req.ip) });
});

export const remove = asyncHandler(async (req, res) => {
  await ulemaService.deleteUlemaProfile(req.params.id, req.user.id, req.ip);
  sendNoContent(res);
});
