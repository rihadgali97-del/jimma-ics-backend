import { prisma } from '../../config/database.js';

export const announcementsRepository = {
  async findMany({ skip, take, search, category, priority, publicOnly }) {
    const where = {
      ...(publicOnly ? { isPublished: true } : {}),
      ...(category ? { category } : {}),
      ...(priority ? { priority } : {}),
      ...(search ? { OR: [
        { title: { contains: search } },
        { summary: { contains: search } },
        { content: { contains: search } },
        { author: { contains: search } },
      ] } : {}),
    };
    const [items, totalItems] = await Promise.all([
      prisma.announcement.findMany({
        where, skip, take,
        orderBy: [{ isPinned: 'desc' }, { publishDate: 'desc' }, { id: 'desc' }],
      }),
      prisma.announcement.count({ where }),
    ]);
    return { items, totalItems };
  },

  findById(id) {
    return prisma.announcement.findUnique({ where: { id } });
  },

  create(data) {
    return prisma.announcement.create({ data });
  },

  update(id, data) {
    return prisma.announcement.update({ where: { id }, data });
  },

  delete(id) {
    return prisma.announcement.delete({ where: { id } });
  },
};
