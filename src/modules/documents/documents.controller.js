import * as documentsService from './documents.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendCreated, sendSuccess, sendNoContent } from '../../common/utils/apiResponse.js';

export const upload = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.body;
  const document = await documentsService.saveUploadedDocument(
    { file: req.file, entityType, entityId },
    req.user.id
  );
  sendCreated(res, document);
});

export const listForEntity = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.query;
  const documents = await documentsService.listDocumentsForEntity(entityType, entityId);
  sendSuccess(res, { data: documents });
});

export const remove = asyncHandler(async (req, res) => {
  await documentsService.deleteDocument(req.params.id, req.user.id);
  sendNoContent(res);
});