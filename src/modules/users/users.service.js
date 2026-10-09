import fs from 'fs/promises';
import { usersRepository } from './users.repository.js';
import { documentsRepository } from '../documents/documents.repository.js';
import { authRepository } from '../auth/auth.repository.js';
import { hashPassword } from '../../common/utils/password.js';
import { NotFoundError, ConflictError, BadRequestError } from '../../common/errors/httpErrors.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';
import { env } from '../../config/env.js';

function toPublicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    role: {
      id: user.role.id,
      name: user.role.name,
      permissions: user.role.permissions.map(({ permission }) => permission.key),
    },
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    metadata: user.metadata,
  };
}

export async function listUsers(query) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const { items, totalItems } = await usersRepository.findMany({
    skip,
    take,
    search: query.search,
    roleId: query.roleId,
    isActive: query.isActive,
  });

  return {
    items: items.map(toPublicUser),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  };
}

export async function getUser(id) {
  const user = await usersRepository.findById(id);
  if (!user) throw new NotFoundError('User not found');
  return toPublicUser(user);
}

export async function createUser({ fullName, email, phone, password, roleId, isActive = true, metadata }, actorId) {
  const role = await usersRepository.findRoleById(roleId);
  if (!role) throw new BadRequestError('roleId does not reference an existing role');

  const existing = await usersRepository.findByEmail(email);
  if (existing) throw new ConflictError('A user with this email already exists');

  const passwordHash = await hashPassword(password);

  const user = await usersRepository.create({
    fullName,
    email,
    phone,
    passwordHash,
    roleId,
    isActive,
    metadata,
  });

  await writeAuditLog({
    actorId,
    action: 'create',
    entityType: 'user',
    entityId: user.id,
    after: toPublicUser(user),
  });

  return toPublicUser(user);
}

export async function updateUser(id, changes, actorId) {
  const existing = await usersRepository.findById(id);
  if (!existing) throw new NotFoundError('User not found');

  if (changes.email && changes.email !== existing.email) {
    const duplicate = await usersRepository.findByEmail(changes.email);
    if (duplicate) throw new ConflictError('A user with this email already exists');
  }

  if (changes.roleId) {
    const role = await usersRepository.findRoleById(changes.roleId);
    if (!role) throw new BadRequestError('roleId does not reference an existing role');
  }

  const wasDeactivated = changes.isActive === false && existing.isActive === true;

  const updated = await usersRepository.update(id, {
    ...changes,
    ...(changes.metadata !== undefined
      ? { metadata: { ...(existing.metadata || {}), ...changes.metadata } }
      : {}),
  });

  // Deactivating an account must also kill any live sessions immediately —
  // otherwise a revoked staff member keeps working until their access token
  // naturally expires.
  if (wasDeactivated) {
    await authRepository.revokeAllRefreshTokensForUser(id);
  }

  await writeAuditLog({
    actorId,
    action: 'update',
    entityType: 'user',
    entityId: id,
    before: toPublicUser(existing),
    after: toPublicUser(updated),
  });

  return toPublicUser(updated);
}

// No hard-delete endpoint by design — staff accounts are referenced by
// audit_logs, refresh_tokens, and (in later phases) assigned case records.
// "Deleting" a user means deactivating them via PATCH /admin/users/:id.
export async function deactivateUser(id, actorId) {
  return updateUser(id, { isActive: false }, actorId);
}

export async function uploadStaffPhoto(id, file, actorId) {
  if (!file) throw new BadRequestError('Choose an image file to upload.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
    await fs.unlink(file.path).catch(() => {});
    throw new BadRequestError('Staff profile photos must be JPEG, PNG, or WebP images.');
  }

  const user = await usersRepository.findById(id);
  if (!user) {
    await fs.unlink(file.path).catch(() => {});
    throw new NotFoundError('User not found');
  }

  const url = `/${env.UPLOAD_DIR}/${file.filename}`;
  await documentsRepository.create({
    entityType: 'staff-avatar',
    entityId: id,
    url,
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    uploadedBy: actorId,
  });

  const updated = await usersRepository.update(id, {
    metadata: { ...(user.metadata || {}), avatar: url },
  });
  await writeAuditLog({
    actorId,
    action: 'upload_profile_photo',
    entityType: 'user',
    entityId: id,
    before: { avatar: user.metadata?.avatar || null },
    after: { avatar: url },
  });
  return { url, user: toPublicUser(updated) };
}