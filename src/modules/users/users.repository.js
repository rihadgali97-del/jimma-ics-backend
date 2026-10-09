import { prisma } from '../../config/database.js';

export const usersRepository = {
  async findMany({ skip, take, search, roleId, isActive }) {
    const where = {
      ...(roleId ? { roleId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
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