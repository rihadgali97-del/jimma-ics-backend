import { prisma } from '../../config/database.js';

export const zakatRepository = {
  createDistribution(data) { return prisma.zakatDistribution.create({ data }); },
  findDistributions() { return prisma.zakatDistribution.findMany({ orderBy: { lastDisbursalDate: 'desc' } }); },
  createAssessment(data) { return prisma.zakatAssessment.create({ data }); },
  findAssessments(userId) { return prisma.zakatAssessment.findMany({ where: { userId }, orderBy: { assessedAt: 'desc' } }); },
  deleteAssessment(id, userId) { return prisma.zakatAssessment.deleteMany({ where: { id, userId } }); },
  create(data) {
    return prisma.zakatApplication.create({ data, include: { woreda: true } });
  },

  findByReference(referenceNumber) {
    return prisma.zakatApplication.findUnique({
      where: { referenceNumber },
      include: { woreda: true, assignedOfficer: true },
    });
  },

  findById(id) {
    return prisma.zakatApplication.findUnique({
      where: { id },
      include: { woreda: true, assignedOfficer: true },
    });
  },

  async findMany({ skip, take, status, woredaId, assignedOfficerId, search }) {
    const where = {
      ...(status ? { status } : {}),
      ...(woredaId ? { woredaId } : {}),
      ...(assignedOfficerId ? { assignedOfficerId } : {}),
      ...(search
        ? {
            OR: [
              { referenceNumber: { contains: search } },
              { applicantFullName: { contains: search } },
              { applicantPhone: { contains: search } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.zakatApplication.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { woreda: true, assignedOfficer: true },
      }),
      prisma.zakatApplication.count({ where }),
    ]);

    return { items, totalItems };
  },

  update(id, data) {
    return prisma.zakatApplication.update({
      where: { id },
      data,
      include: { woreda: true, assignedOfficer: true },
    });
  },

  findWoredaById(id) {
    return prisma.woreda.findUnique({ where: { id } });
  },

  findUserById(id) {
    return prisma.user.findUnique({ where: { id } });
  },

  // --- Nisab rates ---
  createNisabRate(data) {
    return prisma.nisabRate.create({ data });
  },

  findCurrentNisabRate() {
    return prisma.nisabRate.findFirst({ orderBy: { effectiveDate: 'desc' } });
  },

  findNisabRateHistory({ skip, take }) {
    return prisma.nisabRate.findMany({
      skip,
      take,
      orderBy: { effectiveDate: 'desc' },
    });
  },
};
