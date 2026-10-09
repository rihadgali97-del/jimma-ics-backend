import { prisma } from '../../config/database.js';

export const dashboardRepository = {
  async applicationCountsByStatus() {
    const [zakat, janazah] = await Promise.all([
      prisma.zakatApplication.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.janazahRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return { zakat, janazah };
  },

  async mosqueMadrasaCountsByWoreda() {
    const [mosques, madrasas] = await Promise.all([
      prisma.mosque.groupBy({ by: ['woredaId'], _count: { _all: true } }),
      prisma.madrasa.groupBy({ by: ['woredaId'], _count: { _all: true } }),
    ]);
    return { mosques, madrasas };
  },

  countPublishedFinancialReports() {
    return prisma.financialReport.count({ where: { isPublished: true } });
  },

  countWaqfAssets() {
    return prisma.waqfAsset.count();
  },

  findWoredaCodes(ids) {
    return prisma.woreda.findMany({ where: { id: { in: ids } }, select: { id: true, code: true } });
  },
};
