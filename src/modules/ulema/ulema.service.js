import fs from 'fs/promises';
import { env } from '../../config/env.js';
import { BadRequestError, NotFoundError } from '../../common/errors/httpErrors.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { documentsRepository } from '../documents/documents.repository.js';
import { ulemaRepository } from './ulema.repository.js';

const privateFields = ['email'];

function presentProfile(profile, publicOnly) {
  const result = { ...profile };
  if (publicOnly) {
    for (const field of privateFields) delete result[field];
  }
  return result;
}

export async function listUlema(query, { publicOnly }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const { items, totalItems } = await ulemaRepository.findMany({
    skip,
    take,
    search: query.search,
    district: query.district,
    status: query.status,
    publicOnly,
  });
  return {
    items: items.map((profile) => presentProfile(profile, publicOnly)),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  };
}

export async function getUlemaProfile(id, { publicOnly }) {
  const profile = await ulemaRepository.findById(id);
  if (!profile || (publicOnly && !profile.isPublished)) throw new NotFoundError('Scholar profile not found');
  return presentProfile(profile, publicOnly);
}

export async function createUlemaProfile(data, actorId, ip) {
  const profile = await ulemaRepository.create(data);
  await writeAuditLog({
    actorId,
    action: 'create',
    entityType: 'ulema_profile',
    entityId: profile.id,
    after: { name: profile.name, district: profile.district, isPublished: profile.isPublished },
    ip,
  });
  return profile;
}

export async function updateUlemaProfile(id, data, actorId, ip) {
  const existing = await ulemaRepository.findById(id);
  if (!existing) throw new NotFoundError('Scholar profile not found');
  const willBePublished = data.isPublished ?? existing.isPublished;
  const willBeFeatured = data.isFeatured ?? existing.isFeatured;
  if (willBeFeatured && !willBePublished) {
    throw new BadRequestError('A featured scholar must be published to the public directory');
  }
  const profile = await ulemaRepository.update(id, data);
  await writeAuditLog({
    actorId,
    action: 'update',
    entityType: 'ulema_profile',
    entityId: id,
    before: { name: existing.name, isPublished: existing.isPublished },
    after: { name: profile.name, isPublished: profile.isPublished },
    ip,
  });
  return profile;
}

export async function uploadUlemaAvatar(id, file, actorId, ip) {
  if (!file) throw new BadRequestError('Choose an image file to upload.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
    await fs.unlink(file.path).catch(() => {});
    throw new BadRequestError('Scholar profile photos must be JPEG, PNG, or WebP images.');
  }
  const existing = await ulemaRepository.findById(id);
  if (!existing) {
    await fs.unlink(file.path).catch(() => {});
    throw new NotFoundError('Scholar profile not found');
  }

  const url = `/${env.UPLOAD_DIR}/${file.filename}`;
  try {
    await documentsRepository.create({
      entityType: 'ulema-avatar',
      entityId: id,
      url,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedBy: actorId,
    });
    const profile = await ulemaRepository.update(id, { avatar: url });
    await writeAuditLog({
      actorId,
      action: 'upload_profile_photo',
      entityType: 'ulema_profile',
      entityId: id,
      before: { avatar: existing.avatar },
      after: { avatar: url },
      ip,
    });
    return profile;
  } catch (error) {
    await fs.unlink(file.path).catch(() => {});
    throw error;
  }
}

export async function deleteUlemaProfile(id, actorId, ip) {
  const existing = await ulemaRepository.findById(id);
  if (!existing) throw new NotFoundError('Scholar profile not found');
  await ulemaRepository.delete(id);
  await writeAuditLog({
    actorId,
    action: 'delete',
    entityType: 'ulema_profile',
    entityId: id,
    before: { name: existing.name, district: existing.district },
    ip,
  });
}
