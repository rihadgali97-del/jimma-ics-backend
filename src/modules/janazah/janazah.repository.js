import { prisma } from '../../config/database.js';

const JANAZAH_SERVICE_KEY = 'janazah';

export const janazahRepository = {
  async getPublicAvailability() {
    const row = await prisma.civicServiceSetting.findUnique({
      where: { serviceKey: JANAZAH_SERVICE_KEY },
    });
    if (row) return row;
    return prisma.civicServiceSetting.create({
      data: { serviceKey: JANAZAH_SERVICE_KEY, isEnabled: true },
    });
  },

  async setPublicAvailability(isEnabled, updatedById) {
    return prisma.civicServiceSetting.upsert({
      where: { serviceKey: JANAZAH_SERVICE_KEY },
      create: { serviceKey: JANAZAH_SERVICE_KEY, isEnabled, updatedById },
      update: { isEnabled, updatedById },
    });
  },

  create(data) {
    return prisma.janazahRequest.create({ data, include: { woreda: true } });
  },

  findByReference(referenceNumber) {
    return prisma.janazahRequest.findUnique({
      where: { referenceNumber },
      include: { woreda: true, assignedOfficer: true },
    });
  },

  findById(id) {
    return prisma.janazahRequest.findUnique({
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
              { deceasedName: { contains: search } },
              { contactName: { contains: search } },
              { contactPhone: { contains: search } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.janazahRequest.findMany({
        where,
        skip,
        take,
        // Newest first is wrong for an urgent queue — unresolved requests
        // (not COMPLETED/CANCELLED) should surface oldest-first so nothing
        // sits unattended; admins can still sort/filter by status.
        orderBy: { createdAt: 'asc' },
        include: { woreda: true, assignedOfficer: true },
      }),
      prisma.janazahRequest.count({ where }),
    ]);

    return { items, totalItems };
  },

  update(id, data) {
    return prisma.janazahRequest.update({
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

  // --- Cemetery plots ---
  async findManyPlots({ skip, take, woredaId, isAvailable }) {
    const where = {
      ...(woredaId ? { woredaId } : {}),
      ...(isAvailable !== undefined ? { isAvailable } : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.cemeteryPlot.findMany({ where, skip, take, include: { woreda: true } }),
      prisma.cemeteryPlot.count({ where }),
    ]);

    return { items, totalItems };
  },

  findPlotByCode(code) {
    return prisma.cemeteryPlot.findUnique({ where: { code } });
  },

  findPlotById(id) {
    return prisma.cemeteryPlot.findUnique({ where: { id }, include: { woreda: true } });
  },

  createPlot(data) {
    return prisma.cemeteryPlot.create({ data, include: { woreda: true } });
  },

  updatePlot(id, data) {
    return prisma.cemeteryPlot.update({ where: { id }, data, include: { woreda: true } });
  },
};