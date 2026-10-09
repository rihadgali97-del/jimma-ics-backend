import { prisma } from '../../config/database.js';

export const fatwasRepository = {
  async findMany({ skip, take, category, ids, publicOnly }) {
    const where = {
      ...(category ? { category } : {}),
      ...(publicOnly ? { isPublished: true } : {}),
      ...(ids ? { id: { in: ids } } : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.fatwa.findMany({ where, skip, take, orderBy: { publishedAt: 'desc' } }),
      prisma.fatwa.count({ where }),
    ]);

    return { items, totalItems };
  },

  findById(id) {
    return prisma.fatwa.findUnique({ where: { id } });
  },

  create(data) {
    return prisma.fatwa.create({ data });
  },

  update(id, data) {
    return prisma.fatwa.update({ where: { id }, data });
  },

  delete(id) {
    return prisma.fatwa.delete({ where: { id } });
  },
};