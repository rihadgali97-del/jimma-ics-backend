import * as announcementsService from './announcements.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/apiResponse.js';
import * as documentsService from '../documents/documents.service.js';
import { BadRequestError } from '../../common/errors/httpErrors.js';

export const listPublic = asyncHandler(async (req, res) => {
  const result = await announcementsService.listAnnouncements(req.query);
  sendSuccess(res, { data: result.items, meta: result.meta });
});
export const getPublic = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await announcementsService.getAnnouncement(req.params.id) });
});
export const listAdmin = asyncHandler(async (req, res) => {
  const result = await announcementsService.listAnnouncements(req.query, { publicOnly: false });
  sendSuccess(res, { data: result.items, meta: result.meta });
});
export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await announcementsService.createAnnouncement(req.body, req.user.id));
});
export const uploadBanner = asyncHandler(async (req, res) => {
  if (!req.file?.mimetype.startsWith('image/')) throw new BadRequestError('Please upload an image file');
  const document = await documentsService.saveUploadedDocument({ file: req.file, entityType: 'announcement', entityId: req.params.id }, req.user.id);
  sendCreated(res, document);
});
export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await announcementsService.updateAnnouncement(req.params.id, req.body, req.user.id) });
});
export const remove = asyncHandler(async (req, res) => {
  await announcementsService.deleteAnnouncement(req.params.id, req.user.id);
  sendNoContent(res);
});
