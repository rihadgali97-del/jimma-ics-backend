import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as councilArchiveService from './councilArchive.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/apiResponse.js';

export const listCouncilArchive = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await councilArchiveService.listCouncilArchiveDocuments() });
});

export const uploadCouncilArchive = asyncHandler(async (req, res) => {
  const document = await councilArchiveService.createCouncilArchiveDocument(
    { ...req.body, file: req.file },
    req.user.id
  );
  sendCreated(res, document);
});

async function streamDocument(res, { document, body }) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.attachment(document.fileName);
  await pipeline(Readable.fromWeb(body), res);
}

export const downloadCouncilArchive = asyncHandler(async (req, res) => {
  await streamDocument(res, await councilArchiveService.downloadCouncilArchiveDocument(req.params.id));
});

export const createCouncilArchiveShareLink = asyncHandler(async (req, res) => {
  const share = await councilArchiveService.createCouncilDocumentShareLink(req.params.id, req.user.id);
  sendSuccess(res, { data: share, statusCode: 201 });
});

export const downloadSharedCouncilArchiveDocument = asyncHandler(async (req, res) => {
  await streamDocument(res, await councilArchiveService.downloadSharedCouncilDocument(req.params.token));
});

export const deleteCouncilArchive = asyncHandler(async (req, res) => {
  await councilArchiveService.deleteCouncilArchiveDocument(req.params.id, req.user.id);
  sendNoContent(res);
});
