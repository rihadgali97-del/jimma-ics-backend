import { prisma } from '../../config/database.js';

const include = { madrasa: { include: { woreda: true } } };

export const teachersRepository = {
  findMany({ skip, take, search, madrasaId, status, publicOnly }) {
    const where = {
      ...(publicOnly ? { isPublished: true } : {}),
      ...(madrasaId ? { madrasaId } : {}),
      ...(status ? { status } : {}),
      ...(search ? { OR: [
        { name: { contains: search } },
        { specialization: { contains: search } },
        { sanad: { contains: search } },
      ] } : {}),
    };
    return Promise.all([
      prisma.teacher.findMany({
        where,
        ...(skip !== undefined ? { skip, take } : {}),
        orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
        include,
      }),
      prisma.teacher.count({ where }),
    ]).then(([items, totalItems]) => ({ items, totalItems }));
  },

  findById(id) {
    return prisma.teacher.findUnique({ where: { id }, include });
  },

  create(data) {
    return prisma.teacher.create({ data, include });
  },

  update(id, data) {
    return prisma.teacher.update({ where: { id }, data, include });
  },

  delete(id) {
    return prisma.teacher.delete({ where: { id } });
  },
};
