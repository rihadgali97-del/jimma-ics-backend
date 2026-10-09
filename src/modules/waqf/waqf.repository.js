import { prisma } from '../../config/database.js';

export const waqfRepository = {
  async findMany({ skip, take, woredaId, type, publicOnly }) {
    const where = {
      ...(woredaId ? { woredaId } : {}),
      ...(type ? { type } : {}),
      ...(publicOnly ? { isPublished: true } : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.waqfAsset.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { woreda: true },
      }),
      prisma.waqfAsset.count({ where }),
    ]);

    return { items, totalItems };
  },

  findById(id) {
    return prisma.waqfAsset.findUnique({ where: { id }, include: { woreda: true } });
  },

  findWoredaById(id) {
    return prisma.woreda.findUnique({ where: { id } });
  },

  create(data) {
    return prisma.waqfAsset.create({ data });
  },

  update(id, data) {
    return prisma.waqfAsset.update({ where: { id }, data });
  },

  delete(id) {
    return prisma.waqfAsset.delete({ where: { id } });
  },
};