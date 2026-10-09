import { prisma } from '../../config/database.js';

const include = { madrasa: true };

export const studentsRepository = {
  findMany({ skip, take, search, madrasaId }) {
    const where = {
      ...(madrasaId ? { madrasaId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { parentName: { contains: search } },
              { guardianName: { contains: search } },
            ],
          }
        : {}),
    };

    return Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include,
      }),
      prisma.student.count({ where }),
    ]).then(([items, totalItems]) => ({ items, totalItems }));
  },

  findById(id) {
    return prisma.student.findUnique({ where: { id }, include });
  },

  create(data) {
    return prisma.student.create({ data, include });
  },

  update(id, data) {
    return prisma.student.update({ where: { id }, data, include });
  },
};
