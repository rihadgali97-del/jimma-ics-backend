import { janazahRepository } from './janazah.repository.js';
import {
  generateReferenceNumber,
  SERVICE_CODES,
} from '../../common/services/referenceNumber.service.js';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ServiceUnavailableError,
} from '../../common/errors/httpErrors.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';
import { logger } from '../../common/utils/logger.js';

function toAvailability(row) {
  return {
    serviceKey: row.serviceKey,
    isEnabled: row.isEnabled,
    updatedAt: row.updatedAt,
  };
}

export async function getJanazahPublicAvailability() {
  const row = await janazahRepository.getPublicAvailability();
  return toAvailability(row);
}

export async function setJanazahPublicAvailability(isEnabled, actorId) {
  const before = await janazahRepository.getPublicAvailability();
  const row = await janazahRepository.setPublicAvailability(isEnabled, actorId);

  await writeAuditLog({
    actorId,
    action: 'update',
    entityType: 'civic_service_setting',
    entityId: null,
    before: { serviceKey: before.serviceKey, isEnabled: before.isEnabled },
    after: { serviceKey: row.serviceKey, isEnabled: row.isEnabled },
  });

  return toAvailability(row);
}

function toPublic(req) {
  return {
    id: req.id,
    referenceNumber: req.referenceNumber,
    status: req.status,
    woreda: { id: req.woreda.id, code: req.woreda.code },
    deceasedName: req.deceasedName,
    contactName: req.contactName,
    contactPhone: req.contactPhone,
    needsGhusl: req.needsGhusl,
    needsTransport: req.needsTransport,
    needsCemeteryPlot: req.needsCemeteryPlot,
    locationNote: req.locationNote,
    assignedOfficer: req.assignedOfficer
      ? { id: req.assignedOfficer.id, fullName: req.assignedOfficer.fullName }
      : null,
    createdAt: req.createdAt,
    updatedAt: req.updatedAt,
  };
}

function toPublicTrackView(req) {
  return {
    referenceNumber: req.referenceNumber,
    status: req.status,
    deceasedName: req.deceasedName,
    createdAt: req.createdAt,
    updatedAt: req.updatedAt,
  };
}

export async function submitJanazahRequest(data) {
  const availability = await janazahRepository.getPublicAvailability();
  if (!availability.isEnabled) {
    throw new ServiceUnavailableError(
      'Janazah public intake is currently turned off by the council. Please call the 24/7 hotline.'
    );
  }

  const woreda = await janazahRepository.findWoredaById(data.woredaId);
  if (!woreda) throw new BadRequestError('woredaId does not reference an existing woreda');
  if (woreda.isActive === false) throw new BadRequestError('Janazah requests must use an active woreda');

  const referenceNumber = await generateReferenceNumber(SERVICE_CODES.janazah);

  const request = await janazahRepository.create({ ...data, referenceNumber });

  // TODO(Phase 6 - Notifications module): this is the highest-priority
  // dispatch in the whole system — an on-call officer must be paged via
  // SMS/Telegram immediately, with escalation if unacknowledged within a
  // few minutes. Logging is a placeholder only; do not ship to production
  // without real dispatch wired up here.
  logger.warn(
    { referenceNumber, woredaId: data.woredaId, contactPhone: data.contactPhone },
    'URGENT: Janazah request submitted — on-call officer dispatch pending Phase 6'
  );

  await writeAuditLog({
    action: 'submit',
    entityType: 'janazah_request',
    entityId: request.id,
    after: { referenceNumber, woredaId: data.woredaId },
  });

  return toPublic(request);
}

export async function trackJanazahRequest(reference, phone) {
  const request = await janazahRepository.findByReference(reference);

  if (!request || request.contactPhone !== phone) {
    throw new NotFoundError('No request found for that reference number and phone');
  }

  return toPublicTrackView(request);
}

export async function listJanazahRequests(query) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const { items, totalItems } = await janazahRepository.findMany({
    skip,
    take,
    status: query.status,
    woredaId: query.woredaId,
    assignedOfficerId: query.assignedOfficerId,
    search: query.search,
  });

  return {
    items: items.map(toPublic),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  };
}

export async function getJanazahRequest(id) {
  const request = await janazahRepository.findById(id);
  if (!request) throw new NotFoundError('Janazah request not found');
  return toPublic(request);
}

export async function updateJanazahStatus(id, { status }, actorId) {
  const existing = await janazahRepository.findById(id);
  if (!existing) throw new NotFoundError('Janazah request not found');

  const updated = await janazahRepository.update(id, { status });

  logger.info(
    { id, from: existing.status, to: status },
    'Janazah request status changed — contact notification pending Phase 6'
  );

  await writeAuditLog({
    actorId,
    action: 'status_change',
    entityType: 'janazah_request',
    entityId: id,
    before: { status: existing.status },
    after: { status },
  });

  return toPublic(updated);
}

export async function assignJanazahOfficer(id, assignedOfficerId, actorId) {
  const existing = await janazahRepository.findById(id);
  if (!existing) throw new NotFoundError('Janazah request not found');

  if (assignedOfficerId) {
    const officer = await janazahRepository.findUserById(assignedOfficerId);
    if (!officer) throw new BadRequestError('assignedOfficerId does not reference an existing user');
  }

  const updated = await janazahRepository.update(id, { assignedOfficerId });

  await writeAuditLog({
    actorId,
    action: 'assign',
    entityType: 'janazah_request',
    entityId: id,
    before: { assignedOfficerId: existing.assignedOfficerId },
    after: { assignedOfficerId },
  });

  return toPublic(updated);
}

// --- Cemetery plots ---

function toPublicPlot(plot) {
  return {
    id: plot.id,
    code: plot.code,
    isAvailable: plot.isAvailable,
    woreda: { id: plot.woreda.id, code: plot.woreda.code },
    createdAt: plot.createdAt,
  };
}

export async function listCemeteryPlots(query) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const { items, totalItems } = await janazahRepository.findManyPlots({
    skip,
    take,
    woredaId: query.woredaId,
    isAvailable: query.isAvailable,
  });

  return {
    items: items.map(toPublicPlot),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  };
}

export async function createCemeteryPlot({ woredaId, code, isAvailable }, actorId) {
  const woreda = await janazahRepository.findWoredaById(woredaId);
  if (!woreda) throw new BadRequestError('woredaId does not reference an existing woreda');
  if (woreda.isActive === false) throw new BadRequestError('Cemetery plots must use an active woreda');

  const existing = await janazahRepository.findPlotByCode(code);
  if (existing) throw new ConflictError('A cemetery plot with this code already exists');

  const plot = await janazahRepository.createPlot({
    woredaId,
    code,
    isAvailable: isAvailable ?? true,
  });

  await writeAuditLog({
    actorId,
    action: 'create',
    entityType: 'cemetery_plot',
    entityId: plot.id,
    after: { woredaId, code },
  });

  return toPublicPlot(plot);
}

export async function updateCemeteryPlot(id, changes, actorId) {
  const existing = await janazahRepository.findPlotById(id);
  if (!existing) throw new NotFoundError('Cemetery plot not found');

  const updated = await janazahRepository.updatePlot(id, changes);

  await writeAuditLog({
    actorId,
    action: 'update',
    entityType: 'cemetery_plot',
    entityId: id,
    before: { isAvailable: existing.isAvailable },
    after: changes,
  });

  return toPublicPlot(updated);
}