import { prisma } from '../../config/database.js';

export const woredasRepository = {
  async findMany({ skip, take, activeOnly }) {
    const where = activeOnly ? { isActive: true } : {};
    const [items, totalItems] = await Promise.all([
      prisma.woreda.findMany({ where, skip, take, orderBy: { code: 'asc' } }),
      prisma.woreda.count({ where }),
    ]);
    return { items, totalItems };
  },

  findById(id) {
    return prisma.woreda.findUnique({ where: { id } });
  },

  findByCode(code) {
    return prisma.woreda.findUnique({ where: { code } });
  },

  create(data) {
    return prisma.woreda.create({ data });
  },

  update(id, data) {
    return prisma.woreda.update({ where: { id }, data });
  },

  async findGisRelatedRecords(woredaIds, yearStart, nextYearStart) {
    const [mosques, madrasas, distributions, waqfAssets] = await Promise.all([
      prisma.mosque.findMany({
        where: { woredaId: { in: woredaIds }, isPublished: true },
        select: {
          woredaId: true,
          prayerTimes: { where: { prayerName: 'jumuah' }, select: { id: true } },
        },
      }),
      prisma.madrasa.findMany({
        where: { woredaId: { in: woredaIds }, isPublished: true },
        select: { woredaId: true, _count: { select: { students: true } } },
      }),
      prisma.zakatDistribution.findMany({
        where: {
          lastDisbursalDate: { gte: yearStart, lt: nextYearStart },
        },
        select: {
          district: true,
          woredaDistrict: true,
          totalDisbursedETB: true,
        },
      }),
      prisma.waqfAsset.findMany({
        where: { woredaId: { in: woredaIds }, isPublished: true },
        select: { woredaId: true, locationNote: true },
      }),
    ]);
    return { mosques, madrasas, distributions, waqfAssets };
  },
};