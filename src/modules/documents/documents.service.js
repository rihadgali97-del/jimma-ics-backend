import fs from 'fs/promises';
import path from 'path';
import { documentsRepository } from './documents.repository.js';
import { NotFoundError, BadRequestError } from '../../common/errors/httpErrors.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { env } from '../../config/env.js';

export async function saveUploadedDocument({ file, entityType, entityId }, actorId) {
  if (!file) throw new BadRequestError('No file was uploaded (field name must be "file")');

  const document = await documentsRepository.create({
    entityType,
    entityId,
    url: `/${env.UPLOAD_DIR}/${file.filename}`,
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    uploadedBy: actorId,
  });

  await writeAuditLog({
    actorId,
    action: 'upload',
    entityType: 'document',
    entityId: document.id,
    after: { entityType, entityId, fileName: file.originalname },
  });

  return document;
}

export function listDocumentsForEntity(entityType, entityId) {
  return documentsRepository.findByEntity(entityType, entityId);
}

export async function deleteDocument(id, actorId) {
  const document = await documentsRepository.findById(id);
  if (!document) throw new NotFoundError('Document not found');

  await documentsRepository.delete(id);

  // Best-effort local file cleanup — a failure here shouldn't fail the
  // request, the DB row (the source of truth for what "exists") is already gone.
  try {
    await fs.unlink(path.join(env.UPLOAD_DIR, path.basename(document.url)));
  } catch {
    // File may already be gone (e.g. Docker volume reset) — ignore.
  }

  await writeAuditLog({
    actorId,
    action: 'delete',
    entityType: 'document',
    entityId: id,
    before: { entityType: document.entityType, entityId: document.entityId },
  });
}