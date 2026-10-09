import { prisma } from '../../config/database.js';

export const mosquesRepository = {
  async findMany({ skip, take, woredaId, ids, publicOnly }) {
    const where = {
      ...(woredaId ? { woredaId } : {}),
      ...(publicOnly ? { isPublished: true } : {}),
      ...(ids ? { id: { in: ids } } : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.mosque.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { woreda: true, prayerTimes: true, madrasa: true },
      }),
      prisma.mosque.count({ where }),
    ]);

    return { items, totalItems };
  },

  findById(id) {
    return prisma.mosque.findUnique({
      where: { id },
      include: { woreda: true, prayerTimes: true, madrasa: true },
    });
  },

  findWoredaById(id) {
    return prisma.woreda.findUnique({ where: { id } });
  },

  findMadrasaById(id) {
    return prisma.madrasa.findUnique({ where: { id } });
  },

  setMadrasaForMosque(mosqueId, madrasaId) {
    return prisma.$transaction(async (tx) => {
      await tx.madrasa.updateMany({ where: { mosqueId }, data: { mosqueId: null } });
      if (madrasaId != null) {
        await tx.madrasa.update({ where: { id: madrasaId }, data: { mosqueId } });
      }
    });
  },

  create(data, madrasaId) {
    return prisma.$transaction(async (tx) => {
      const mosque = await tx.mosque.create({ data });
      if (madrasaId != null) {
        await tx.madrasa.update({ where: { id: madrasaId }, data: { mosqueId: mosque.id } });
      }
      return mosque;
    });
  },

  update(id, data) {
    return prisma.mosque.update({ where: { id }, data });
  },

  delete(id) {
    return prisma.mosque.delete({ where: { id } });
  },

  upsertPrayerTimes(mosqueId, prayerTimes) {
    return prisma.$transaction(
      prayerTimes.map((pt) =>
        prisma.mosquePrayerTime.upsert({
          where: { mosqueId_prayerName: { mosqueId, prayerName: pt.prayerName } },
          update: { time: pt.time },
          create: { mosqueId, prayerName: pt.prayerName, time: pt.time },
        })
      )
    );
  },
};