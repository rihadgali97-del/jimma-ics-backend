import { prisma } from '../../config/database.js';

export const madrasasRepository = {
  async findMany({ skip, take, woredaId, ids, publicOnly }) {
    const where = {
      ...(woredaId ? { woredaId } : {}),
      ...(publicOnly ? { isPublished: true } : {}),
      ...(ids ? { id: { in: ids } } : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.madrasa.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { woreda: true, headTeacher: true },
      }),
      prisma.madrasa.count({ where }),
    ]);

    return { items, totalItems };
  },

  findById(id) {
    return prisma.madrasa.findUnique({
      where: { id },
      include: { woreda: true, headTeacher: true },
    });
  },

  findWoredaById(id) {
    return prisma.woreda.findUnique({ where: { id } });
  },

  findTeacherById(id) {
    return prisma.teacher.findUnique({ where: { id } });
  },

  create(data) {
    return prisma.madrasa.create({ data });
  },

  update(id, data) {
    return prisma.madrasa.update({ where: { id }, data });
  },

  delete(id) {
    return prisma.madrasa.delete({ where: { id } });
  },
};