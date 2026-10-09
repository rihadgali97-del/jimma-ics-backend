import { prisma } from '../../config/database.js';

export const documentsRepository = {
  create(data) {
    return prisma.document.create({ data });
  },

  findByEntity(entityType, entityId) {
    return prisma.document.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'asc' },
    });
  },

  findByEntities(entityType, entityIds) {
    return prisma.document.findMany({
      where: { entityType, entityId: { in: entityIds } },
      orderBy: { createdAt: 'asc' },
    });
  },

  findById(id) {
    return prisma.document.findUnique({ where: { id } });
  },

  delete(id) {
    return prisma.document.delete({ where: { id } });
  },
};

export const councilArchiveRepository = {
  findMany() {
    return prisma.councilArchiveDocument.findMany({ orderBy: { createdAt: 'desc' } });
  },

  create(data) {
    return prisma.councilArchiveDocument.create({ data });
  },

  findById(id) {
    return prisma.councilArchiveDocument.findUnique({ where: { id } });
  },

  delete(id) {
    return prisma.councilArchiveDocument.delete({ where: { id } });
  },

  createShareLink(data) {
    return prisma.councilDocumentShareLink.create({ data });
  },

  findValidShareLink(tokenHash, now) {
    return prisma.councilDocumentShareLink.findFirst({
      where: { tokenHash, expiresAt: { gt: now } },
      include: { document: true },
    });
  },

  deleteExpiredShareLinks(now) {
    return prisma.councilDocumentShareLink.deleteMany({ where: { expiresAt: { lte: now } } });
  },
};