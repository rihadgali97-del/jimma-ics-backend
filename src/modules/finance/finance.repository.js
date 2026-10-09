import { prisma } from '../../config/database.js';

export const financeRepository = {
  async findMany({ skip, take, type, publicOnly }) {
    const where = {
      ...(type ? { type } : {}),
      ...(publicOnly ? { isPublished: true } : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.financialReport.findMany({
        where,
        skip,
        take,
        orderBy: { periodStart: 'desc' },
        include: { lineItems: true },
      }),
      prisma.financialReport.count({ where }),
    ]);

    return { items, totalItems };
  },

  findById(id) {
    return prisma.financialReport.findUnique({ where: { id }, include: { lineItems: true } });
  },

  create(data) {
    return prisma.financialReport.create({ data });
  },

  update(id, data) {
    return prisma.financialReport.update({ where: { id }, data });
  },

  delete(id) {
    return prisma.financialReport.delete({ where: { id } });
  },

  replaceLineItems(reportId, lineItems) {
    return prisma.$transaction([
      prisma.financialReportLineItem.deleteMany({ where: { financialReportId: reportId } }),
      prisma.financialReportLineItem.createMany({
        data: lineItems.map((li) => ({ ...li, financialReportId: reportId })),
      }),
    ]);
  },
};