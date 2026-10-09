import { zakatRepository } from './zakat.repository.js';
import { generateReferenceNumber, SERVICE_CODES } from '../../common/services/referenceNumber.service.js';
import {
  NotFoundError,
  BadRequestError,
  ServiceUnavailableError,
} from '../../common/errors/httpErrors.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';
import { logger } from '../../common/utils/logger.js';
import { getCivicServiceAvailability } from '../civic-services/civic-services.service.js';

function toPublic(app) {
  return {
    id: app.id,
    referenceNumber: app.referenceNumber,
    status: app.status,
    woreda: { id: app.woreda.id, code: app.woreda.code },
    applicantFullName: app.applicantFullName,
    applicantPhone: app.applicantPhone,
    householdSize: app.householdSize,
    eligibilityNotes: app.eligibilityNotes,
    assignedOfficer: app.assignedOfficer
      ? { id: app.assignedOfficer.id, fullName: app.assignedOfficer.fullName }
      : null,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}

// Public tracker view deliberately omits internal-only fields (assigned
// officer identity, admin eligibility notes) — a citizen checking their
// application status shouldn't see internal casework detail.
function toPublicTrackView(app) {
  return {
    referenceNumber: app.referenceNumber,
    status: app.status,
    applicantFullName: app.applicantFullName,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}

export async function submitZakatApplication(data) {
  const availability = await getCivicServiceAvailability('srv-2');
  if (!availability.isEnabled) {
    throw new ServiceUnavailableError(
      'Zakat public intake is currently turned off by the council. Please contact the Zakat desk.'
    );
  }

  const woreda = await zakatRepository.findWoredaById(data.woredaId);
  if (!woreda) throw new BadRequestError('woredaId does not reference an existing woreda');
  if (woreda.isActive === false) throw new BadRequestError('Zakat applications must use an active woreda');

  const referenceNumber = await generateReferenceNumber(SERVICE_CODES.zakat);

  const application = await zakatRepository.create({ ...data, referenceNumber });

  // TODO(Phase 6 - Notifications module): send SMS/email confirmation with
  // the reference number instead of just logging it.
  logger.info(
    { referenceNumber, phone: data.applicantPhone },
    'Zakat application submitted — confirmation dispatch pending Phase 6'
  );

  await writeAuditLog({
    action: 'submit',
    entityType: 'zakat_application',
    entityId: application.id,
    after: { referenceNumber, woredaId: data.woredaId },
  });

  return toPublic(application);
}

export async function trackZakatApplication(reference, phone) {
  const application = await zakatRepository.findByReference(reference);

  // Same 404 whether the reference doesn't exist or the phone doesn't
  // match — don't let this endpoint confirm a reference number is real to
  // someone who doesn't also know the applicant's phone number.
  if (!application || application.applicantPhone !== phone) {
    throw new NotFoundError('No application found for that reference number and phone');
  }

  return toPublicTrackView(application);
}

export async function listZakatApplications(query) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const { items, totalItems } = await zakatRepository.findMany({
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

export async function getZakatApplication(id) {
  const application = await zakatRepository.findById(id);
  if (!application) throw new NotFoundError('Zakat application not found');
  return toPublic(application);
}

export async function updateZakatStatus(id, { status, eligibilityNotes }, actorId) {
  const existing = await zakatRepository.findById(id);
  if (!existing) throw new NotFoundError('Zakat application not found');

  const updated = await zakatRepository.update(id, {
    status,
    ...(eligibilityNotes !== undefined ? { eligibilityNotes } : {}),
  });

  // TODO(Phase 6): notify the applicant of the status change via SMS.
  logger.info(
    { id, from: existing.status, to: status },
    'Zakat application status changed — applicant notification pending Phase 6'
  );

  await writeAuditLog({
    actorId,
    action: 'status_change',
    entityType: 'zakat_application',
    entityId: id,
    before: { status: existing.status },
    after: { status },
  });

  return toPublic(updated);
}

export async function assignZakatOfficer(id, assignedOfficerId, actorId) {
  const existing = await zakatRepository.findById(id);
  if (!existing) throw new NotFoundError('Zakat application not found');

  if (assignedOfficerId) {
    const officer = await zakatRepository.findUserById(assignedOfficerId);
    if (!officer) throw new BadRequestError('assignedOfficerId does not reference an existing user');
  }

  const updated = await zakatRepository.update(id, { assignedOfficerId });

  await writeAuditLog({
    actorId,
    action: 'assign',
    entityType: 'zakat_application',
    entityId: id,
    before: { assignedOfficerId: existing.assignedOfficerId },
    after: { assignedOfficerId },
  });

  return toPublic(updated);
}

// --- Nisab rates ---

export async function getCurrentNisabRate() {
  const rate = await zakatRepository.findCurrentNisabRate();
  if (!rate) return null;
  return {
    goldPricePerGram: rate.goldPricePerGram,
    silverPricePerGram: rate.silverPricePerGram,
    effectiveDate: rate.effectiveDate,
  };
}

export async function setNisabRate({ goldPricePerGram, silverPricePerGram, effectiveDate }, actorId) {
  const rate = await zakatRepository.createNisabRate({
    goldPricePerGram,
    silverPricePerGram,
    effectiveDate: effectiveDate ?? new Date(),
  });

  await writeAuditLog({
    actorId,
    action: 'update',
    entityType: 'nisab_rate',
    entityId: rate.id,
    after: { goldPricePerGram, silverPricePerGram },
  });

  return {
    goldPricePerGram: rate.goldPricePerGram,
    silverPricePerGram: rate.silverPricePerGram,
    effectiveDate: rate.effectiveDate,
  };
}

export async function listAssessments(userId) {
  const rows = await zakatRepository.findAssessments(userId);
  return rows.map((row) => ({ id: String(row.id), title: row.title, date: row.assessedAt, ...row.summary }));
}

export async function saveAssessment(userId, { title, summary }) {
  const row = await zakatRepository.createAssessment({ userId, title, summary });
  return { id: String(row.id), title: row.title, date: row.assessedAt, ...row.summary };
}

export async function deleteAssessment(userId, id) {
  const result = await zakatRepository.deleteAssessment(Number(id), userId);
  if (result.count === 0) throw new NotFoundError('Zakat assessment not found');
}

export async function listZakatDistributions() {
  const rows = await zakatRepository.findDistributions();
  return rows.map((row) => ({
    ...row,
    id: String(row.id),
    totalDisbursedETB: Number(row.totalDisbursedETB),
    amountETB: row.amountETB === null ? undefined : Number(row.amountETB),
    lastDisbursalDate: row.lastDisbursalDate.toISOString().slice(0, 10),
    disbursementDate: row.disbursementDate?.toISOString().slice(0, 10),
  }));
}

export async function createZakatDistribution(data, actorId) {
  const row = await zakatRepository.createDistribution({
    ...data,
    beneficiaryCount: data.beneficiaryCount ?? 1,
    lastDisbursalDate: data.lastDisbursalDate ?? data.disbursementDate ?? new Date(),
    createdById: actorId,
  });

  await writeAuditLog({
    actorId,
    action: 'create',
    entityType: 'zakat_distribution',
    entityId: row.id,
    after: { asnafCategory: row.asnafCategory, totalDisbursedETB: row.totalDisbursedETB, beneficiaryCount: row.beneficiaryCount },
  });

  return (await listZakatDistributions()).find((item) => item.id === String(row.id));
}
