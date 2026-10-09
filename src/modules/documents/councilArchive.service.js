import { v2 as cloudinary } from 'cloudinary';
import { createHash, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import path from 'node:path';
import { AppError } from '../../common/errors/AppError.js';
import { NotFoundError, BadRequestError } from '../../common/errors/httpErrors.js';
import { env } from '../../config/env.js';
import { logger } from '../../common/utils/logger.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { councilArchiveRepository } from './documents.repository.js';

function toArchiveDto({ cloudinaryPublicId: _publicId, cloudinaryVersion: _version, ...document }) {
  return document;
}

function isCloudinaryConfigured() {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

function getCloudinary() {
  if (!isCloudinaryConfigured()) {
    throw new AppError('Council document storage is not configured on the server', {
      statusCode: 503,
      code: 'DOCUMENT_STORAGE_NOT_CONFIGURED',
    });
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

function uploadToCloudinary(file) {
  const client = getCloudinary();
  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        resource_type: 'raw',
        type: 'authenticated',
        folder: env.CLOUDINARY_COUNCIL_DOCUMENTS_FOLDER,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          logger.error(
            { cloudinaryStatus: error.http_code ?? null, cloudinaryError: error.message ?? 'Unknown upload error' },
            'Cloudinary council document upload failed'
          );
          if (error.http_code === 403) {
            return reject(new AppError(
              'Cloudinary denied this upload because the API key is missing create permission. Grant create/upload access to this API key and restart the backend.',
              { statusCode: 503, code: 'DOCUMENT_STORAGE_PERMISSION_DENIED' }
            ));
          }
          return reject(new AppError('Cloudinary could not store the document', { statusCode: 502, code: 'DOCUMENT_STORAGE_FAILED' }));
        }
        if (!result?.public_id || result.version == null) {
          return reject(new AppError('Cloudinary returned an incomplete upload result', { statusCode: 502, code: 'DOCUMENT_STORAGE_FAILED' }));
        }
        resolve(result);
      }
    );
    Readable.from([file.buffer]).pipe(stream);
  });
}

async function removeFromCloudinary(publicId) {
  const client = getCloudinary();
  const result = await client.uploader.destroy(publicId, {
    resource_type: 'raw',
    type: 'authenticated',
    invalidate: true,
  });
  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new AppError('Cloudinary could not remove the stored document', { statusCode: 502, code: 'DOCUMENT_STORAGE_DELETE_FAILED' });
  }
}

export function listCouncilArchiveDocuments() {
  return councilArchiveRepository.findMany().then((documents) => documents.map(toArchiveDto));
}

export async function createCouncilArchiveDocument({ file, title, category, description }, actorId) {
  if (!file) throw new BadRequestError('Please select a document to upload');
  if (!file.size) throw new BadRequestError('The selected document is empty');
  const fileName = path.basename(file.originalname.replace(/[\\/]/g, '/')).replaceAll('\0', '').slice(0, 255) || 'council-document';
  const uploaded = await uploadToCloudinary(file);

  try {
    const document = await councilArchiveRepository.create({
      title,
      category,
      description: description || null,
      fileName,
      mimeType: file.mimetype || 'application/octet-stream',
      sizeBytes: file.size,
      cloudinaryPublicId: uploaded.public_id,
      cloudinaryVersion: uploaded.version,
      uploadedBy: actorId,
    });

    await writeAuditLog({
      actorId,
      action: 'upload',
      entityType: 'council_archive_document',
      entityId: document.id,
      after: { title, category, fileName, sizeBytes: file.size },
    });
    return toArchiveDto(document);
  } catch (error) {
    try {
      await removeFromCloudinary(uploaded.public_id);
    } catch (cleanupError) {
      logger.error({ err: cleanupError, publicId: uploaded.public_id }, 'Failed to remove Cloudinary file after database save failure');
    }
    throw error;
  }
}

export async function getCouncilArchiveDocument(id) {
  const document = await councilArchiveRepository.findById(id);
  if (!document) throw new NotFoundError('Council document not found');
  return document;
}

async function downloadDocumentFile(document) {
  const client = getCloudinary();
  const url = client.url(document.cloudinaryPublicId, {
    resource_type: 'raw',
    type: 'authenticated',
    version: document.cloudinaryVersion,
    sign_url: true,
    secure: true,
  });
  const response = await globalThis.fetch(url);
  if (!response.ok || !response.body) {
    throw new AppError('Cloudinary could not deliver the requested document', { statusCode: 502, code: 'DOCUMENT_DELIVERY_FAILED' });
  }
  return { document, body: response.body };
}

export async function downloadCouncilArchiveDocument(id) {
  return downloadDocumentFile(await getCouncilArchiveDocument(id));
}

function hashShareToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createCouncilDocumentShareLink(id, actorId) {
  const document = await getCouncilArchiveDocument(id);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const token = randomBytes(32).toString('hex');
  await councilArchiveRepository.deleteExpiredShareLinks(now);
  await councilArchiveRepository.createShareLink({
    documentId: document.id,
    tokenHash: hashShareToken(token),
    expiresAt,
  });
  await writeAuditLog({
    actorId,
    action: 'share_link_created',
    entityType: 'council_archive_document',
    entityId: document.id,
    after: { expiresAt: expiresAt.toISOString() },
  });
  return { token, expiresAt };
}

export async function downloadSharedCouncilDocument(token) {
  const shareLink = await councilArchiveRepository.findValidShareLink(hashShareToken(token), new Date());
  if (!shareLink) throw new NotFoundError('This document share link is invalid or has expired');
  return downloadDocumentFile(shareLink.document);
}

export async function deleteCouncilArchiveDocument(id, actorId) {
  const document = await getCouncilArchiveDocument(id);
  await removeFromCloudinary(document.cloudinaryPublicId);
  await councilArchiveRepository.delete(id);
  await writeAuditLog({
    actorId,
    action: 'delete',
    entityType: 'council_archive_document',
    entityId: id,
    before: { title: document.title, fileName: document.fileName },
  });
}
