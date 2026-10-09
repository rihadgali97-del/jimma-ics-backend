import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { validate } from '../../common/middlewares/validate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/apiResponse.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors/httpErrors.js';
import { prisma } from '../../config/database.js';

export const rolesRouter = Router();
const systemRoleNames = new Set([
  'super_admin',
  'secretariat_admin',
  'case_officer',
  'finance_officer',
  'content_editor',
  'dispatcher',
  'pending_staff',
]);
const metadataSchema = z.record(z.unknown()).optional();
const roleBody = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  permissions: z.array(z.string().trim().min(1).max(150)).transform((items) => [...new Set(items)]).optional(),
  metadata: metadataSchema,
});

function toPublicRole(role) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: role.permissions.map(({ permission }) => permission.key),
    isSystemRole: systemRoleNames.has(role.name),
    assignedUsersCount: role._count?.users ?? 0,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    metadata: role.metadata,
  };
}

async function getRole(id) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  });
  if (!role) throw new NotFoundError('Role not found');
  return role;
}

rolesRouter.use(authenticate, authorize('roles.manage'));

rolesRouter.get('/', asyncHandler(async (req, res) => {
  const roles = await prisma.role.findMany({
    orderBy: { id: 'asc' },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  });
  sendSuccess(res, { data: roles.map(toPublicRole) });
}));

rolesRouter.post('/', validate(z.object({ body: roleBody })), asyncHandler(async (req, res) => {
  const { name, description, permissions = [], metadata = {} } = req.body;
  if (systemRoleNames.has(name)) throw new BadRequestError('Reserved system role names cannot be created.');
  const existing = await prisma.role.findUnique({ where: { name } });
  if (existing) throw new ConflictError('A role with this name already exists.');

  const role = await prisma.$transaction(async (tx) => {
    const permissionRecords = await Promise.all(permissions.map((key) => tx.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    })));
    return tx.role.create({
      data: {
        name,
        description: description || null,
        metadata,
        permissions: { create: permissionRecords.map((permission) => ({ permissionId: permission.id })) },
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
  });
  await writeAuditLog({
    actorId: req.user.id,
    action: 'create',
    entityType: 'role',
    entityId: role.id,
    after: toPublicRole(role),
    ip: req.ip,
  });
  sendCreated(res, toPublicRole(role));
}));

rolesRouter.patch('/:id', validate(z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: roleBody.partial().refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  }),
})), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await getRole(id);
  const { permissions, ...changes } = req.body;
  if (existing.name === 'super_admin') {
    throw new BadRequestError('The super_admin role has full access by system policy and cannot be modified.');
  }
  if (systemRoleNames.has(existing.name) && Object.keys(changes).length > 0) {
    throw new BadRequestError('System role details are protected; only permissions can be changed.');
  }
  if (changes.name && changes.name !== existing.name && systemRoleNames.has(changes.name)) {
    throw new BadRequestError('Reserved system role names cannot be used.');
  }
  if (changes.name && changes.name !== existing.name) {
    const duplicate = await prisma.role.findUnique({ where: { name: changes.name } });
    if (duplicate) throw new ConflictError('A role with this name already exists.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (permissions !== undefined) {
      const permissionRecords = await Promise.all(permissions.map((key) => tx.permission.upsert({
        where: { key },
        update: {},
        create: { key },
      })));
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissionRecords.length) {
        await tx.rolePermission.createMany({
          data: permissionRecords.map((permission) => ({ roleId: id, permissionId: permission.id })),
        });
      }
    }
    return tx.role.update({
      where: { id },
      data: {
        ...changes,
        ...(permissions !== undefined && systemRoleNames.has(existing.name)
          ? { metadata: { ...(existing.metadata || {}), permissionsCustomized: true } }
          : {}),
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
  });
  await writeAuditLog({
    actorId: req.user.id,
    action: 'update',
    entityType: 'role',
    entityId: id,
    before: toPublicRole(existing),
    after: toPublicRole(updated),
    ip: req.ip,
  });
  sendSuccess(res, { data: toPublicRole(updated) });
}));

rolesRouter.delete('/:id', validate(z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
})), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const role = await getRole(id);
  if (systemRoleNames.has(role.name)) throw new BadRequestError('System roles cannot be deleted.');
  if (role._count.users > 0) throw new ConflictError('Reassign staff accounts before deleting this role.');
  await prisma.role.delete({ where: { id } });
  await writeAuditLog({
    actorId: req.user.id,
    action: 'delete',
    entityType: 'role',
    entityId: id,
    before: toPublicRole(role),
    ip: req.ip,
  });
  sendNoContent(res);
}));
