import { prisma } from '../../config/database.js';

export const leadershipRepository = {
  async findMany({ skip, take, publicOnly }) {
    const where = publicOnly ? { isPublished: true } : {};

    const [items, totalItems] = await Promise.all([
      prisma.leadershipProfile.findMany({ where, skip, take, orderBy: { displayOrder: 'asc' } }),
      prisma.leadershipProfile.count({ where }),
    ]);

    return { items, totalItems };
  },

  findById(id) {
    return prisma.leadershipProfile.findUnique({ where: { id } });
  },

  create(data) {
    return prisma.leadershipProfile.create({ data });
  },

  update(id, data) {
    return prisma.leadershipProfile.update({ where: { id }, data });
  },

  delete(id) {
    return prisma.leadershipProfile.delete({ where: { id } });
  },
};