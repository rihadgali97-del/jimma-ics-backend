import { prisma } from '../../config/database.js';

export const ulemaRepository = {
  async findMany({ skip, take, search, district, status, publicOnly }) {
    const where = {
      ...(publicOnly ? { isPublished: true } : {}),
      ...(district ? { district } : {}),
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search } },
          { arabicName: { contains: search } },
          { title: { contains: search } },
          { district: { contains: search } },
        ],
      } : {}),
    };
    const [items, totalItems] = await Promise.all([
      prisma.ulemaProfile.findMany({
        where,
        skip,
        take,
        orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
      }),
      prisma.ulemaProfile.count({ where }),
    ]);
    return { items, totalItems };
  },

  findById(id) {
    return prisma.ulemaProfile.findUnique({ where: { id } });
  },

  create(data) {
    return prisma.ulemaProfile.create({ data });
  },

  update(id, data) {
    return prisma.ulemaProfile.update({ where: { id }, data });
  },

  delete(id) {
    return prisma.ulemaProfile.delete({ where: { id } });
  },
};
