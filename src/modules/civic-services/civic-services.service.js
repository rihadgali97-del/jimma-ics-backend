import { civicServicesRepository } from './civic-services.repository.js';
import { CIVIC_SERVICE_KEYS } from './civic-services.constants.js';
import { BadRequestError } from '../../common/errors/httpErrors.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';

function validateServiceKey(serviceKey) {
  if (!CIVIC_SERVICE_KEYS.includes(serviceKey)) {
    throw new BadRequestError('Unknown public civic service');
  }
}

export async function listCivicServiceAvailability() {
  return civicServicesRepository.listAvailability();
}

export async function getCivicServiceAvailability(serviceKey) {
  validateServiceKey(serviceKey);
  return civicServicesRepository.getAvailability(serviceKey);
}

export async function setCivicServiceAvailability(serviceKey, isEnabled, actorId) {
  validateServiceKey(serviceKey);
  const before = await civicServicesRepository.getAvailability(serviceKey);
  const row = await civicServicesRepository.setAvailability(serviceKey, isEnabled, actorId);

  await writeAuditLog({
    actorId,
    action: 'update',
    entityType: 'civic_service_setting',
    entityId: null,
    before: { serviceKey, isEnabled: before.isEnabled },
    after: { serviceKey, isEnabled: row.isEnabled },
  });

  return {
    serviceKey: row.serviceKey,
    isEnabled: row.isEnabled,
    updatedAt: row.updatedAt,
  };
}
