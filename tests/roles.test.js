import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  role: {
    findUnique: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockVerifyAccessToken = jest.fn();

jest.unstable_mockModule('../src/config/database.js', () => ({
  prisma: mockPrisma,
}));

jest.unstable_mockModule('../src/common/utils/jwt.js', () => ({
  verifyAccessToken: mockVerifyAccessToken,
}));

const { rolesRouter } = await import('../src/modules/roles/role.routes.js');

const adminUser = {
  id: 1,
  fullName: 'System Administrator',
  email: 'admin@example.com',
  roleId: 1,
  isActive: true,
  role: { name: 'super_admin', permissions: [] },
  metadata: null,
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/admin/roles', rolesRouter);
  app.use((error, req, res, _next) => {
    res.status(error.statusCode || 500).json({ error: error.message });
  });
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyAccessToken.mockReturnValue({ sub: 1 });
  mockPrisma.user.findUnique.mockResolvedValue(adminUser);
  mockPrisma.role.findUnique.mockResolvedValue(null);
  mockPrisma.auditLog.create.mockResolvedValue({ id: 1 });
  mockPrisma.$transaction.mockImplementation(async (callback) => {
    const permissionRecords = new Map();
    let nextPermissionId = 1;
    return callback({
      permission: {
        upsert: jest.fn(async ({ where }) => {
          if (!permissionRecords.has(where.key)) {
            permissionRecords.set(where.key, {
              id: nextPermissionId++,
              key: where.key,
            });
          }
          return permissionRecords.get(where.key);
        }),
      },
      role: {
        create: jest.fn(async ({ data }) => ({
          id: 12,
          name: data.name,
          description: data.description,
          metadata: data.metadata,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          permissions: data.permissions.create.map(({ permissionId }) => ({
            permission: [...permissionRecords.values()].find(({ id }) => id === permissionId),
          })),
          _count: { users: 0 },
        })),
      },
    });
  });
});

describe('custom role management', () => {
  it('creates a custom role with deduplicated, catalog-approved permissions', async () => {
    const res = await request(createApp())
      .post('/admin/roles')
      .set('Authorization', 'Bearer valid-token')
      .send({
        name: 'event_reviewers',
        description: 'Manage council events',
        permissions: ['events.write', 'events.write'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'event_reviewers',
      permissions: ['events.write'],
      isSystemRole: false,
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects permissions outside the canonical catalog without writing to the database', async () => {
    const res = await request(createApp())
      .post('/admin/roles')
      .set('Authorization', 'Bearer valid-token')
      .send({
        name: 'invalid_custom_role',
        permissions: ['events.write', 'made.up.permission'],
      });

    expect(res.status).toBe(422);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not let a role without roles.manage create a custom role', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...adminUser,
      role: {
        name: 'event_reviewers',
        permissions: [{ permission: { key: 'events.write' } }],
      },
    });

    const res = await request(createApp())
      .post('/admin/roles')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'new_custom_role', permissions: ['events.write'] });

    expect(res.status).toBe(403);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
