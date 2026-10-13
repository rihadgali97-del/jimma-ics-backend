import { prisma } from '../../config/database.js';

export const usersRepository = {
  async findMany({ skip, take, search, roleId, isActive, department, district, status }) {
    const metadataEquals = (key, value) => ({
      metadata: { path: `$.${key}`, string_contains: value },
    });
    const inactiveStatuses = ['On Leave', 'Pending Invitation'];
    const where = {
      ...(roleId ? { roleId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(department ? metadataEquals('department', department) : {}),
      ...(district ? metadataEquals('district', district) : {}),
      ...(status === 'Active' ? { isActive: true } : {}),
      ...(status === 'On Leave' || status === 'Pending Invitation'
        ? { isActive: false, ...metadataEquals('status', status) }
        : {}),
      ...(status === 'Suspended'
        ? {
            isActive: false,
            NOT: inactiveStatuses.map((value) => metadataEquals('status', value)),
          }
        : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search } },
              { email: { contains: search } },
              { phone: { contains: search } },
              { metadata: { path: '$.title', string_contains: search } },
              { metadata: { path: '$.district', string_contains: search } },
              { metadata: { path: '$.arabicName', string_contains: search } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      }),
      prisma.user.count({ where }),
    ]);

    return { items, totalItems };
  },

  findById(id) {
    return prisma.user.findUnique({
      where: { id },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
  },

  findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  },

  create(data) {
    return prisma.user.create({
      data,
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
  },

  update(id, data) {
    return prisma.user.update({
      where: { id },
      data,
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
  },

  findRoleById(id) {
    return prisma.role.findUnique({ where: { id } });
  },
};