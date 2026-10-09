import { prisma } from '../../config/database.js';
import { CIVIC_SERVICE_KEYS } from './civic-services.constants.js';

function toAvailability(serviceKey, row) {
  return {
    serviceKey,
    isEnabled: row?.isEnabled ?? true,
    updatedAt: row?.updatedAt ?? null,
  };
}

export const civicServicesRepository = {
  async listAvailability() {
    const rows = await prisma.civicServiceSetting.findMany({
      where: { serviceKey: { in: CIVIC_SERVICE_KEYS } },
    });
    const byKey = new Map(rows.map((row) => [row.serviceKey, row]));
    return CIVIC_SERVICE_KEYS.map((serviceKey) => toAvailability(serviceKey, byKey.get(serviceKey)));
  },

  async getAvailability(serviceKey) {
    const row = await prisma.civicServiceSetting.findUnique({ where: { serviceKey } });
    return toAvailability(serviceKey, row);
  },

  setAvailability(serviceKey, isEnabled, updatedById) {
    return prisma.civicServiceSetting.upsert({
      where: { serviceKey },
      create: { serviceKey, isEnabled, updatedById },
      update: { isEnabled, updatedById },
    });
  },
};
