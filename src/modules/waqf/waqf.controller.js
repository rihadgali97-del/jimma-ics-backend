import * as waqfService from './waqf.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../common/utils/apiResponse.js';
import * as documentsService from '../documents/documents.service.js';
import { BadRequestError } from '../../common/errors/httpErrors.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await waqfService.listWaqfAssets(req.query, { publicOnly: true });
  sendSuccess(res, { data: items, meta });
});

export const getById = asyncHandler(async (req, res) => {
  const asset = await waqfService.getWaqfAsset(req.params.id, req.query.locale, {
    publicOnly: true,
  });
  sendSuccess(res, { data: asset });
});

// --- Admin ---

export const adminList = asyncHandler(async (req, res) => {
  const { items, meta } = await waqfService.listWaqfAssets(req.query, { publicOnly: false });
  sendSuccess(res, { data: items, meta });
});

export const adminGetById = asyncHandler(async (req, res) => {
  const asset = await waqfService.getWaqfAsset(req.params.id, req.query.locale, {
    publicOnly: false,
  });
  sendSuccess(res, { data: asset });
});

export const create = asyncHandler(async (req, res) => {
  const asset = await waqfService.createWaqfAsset(req.body, req.user.id);
  sendCreated(res, asset);
});

export const update = asyncHandler(async (req, res) => {
  const asset = await waqfService.updateWaqfAsset(req.params.id, req.body, req.user.id);
  sendSuccess(res, { data: asset });
});

export const remove = asyncHandler(async (req, res) => {
  await waqfService.deleteWaqfAsset(req.params.id, req.user.id);
  sendNoContent(res);
});

export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file?.mimetype.startsWith('image/')) throw new BadRequestError('Please upload an image file');
  const document = await documentsService.saveUploadedDocument({ file: req.file, entityType: 'waqf_asset', entityId: req.params.id }, req.user.id);
  sendCreated(res, document);
});
