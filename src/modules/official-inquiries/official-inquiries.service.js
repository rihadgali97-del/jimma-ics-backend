import { randomUUID } from 'node:crypto';
import { officialInquiriesRepository } from './official-inquiries.repository.js';
import { NotFoundError } from '../../common/errors/httpErrors.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';

function toPublicConfirmation(inquiry) {
  return {
    referenceNumber: inquiry.referenceNumber,
    status: inquiry.status,
    createdAt: inquiry.createdAt,
  };
}

function normalizePhone(phone) {
  return phone.replace(/[^\d+]/g, '');
}

export async function trackOfficialInquiry(referenceNumber, phone) {
  const inquiry = await officialInquiriesRepository.findByReference(referenceNumber.trim().toUpperCase());
  if (!inquiry || normalizePhone(inquiry.phone) !== normalizePhone(phone)) {
    throw new NotFoundError('No inquiry found for that reference number and phone');
  }

  return {
    referenceNumber: inquiry.referenceNumber,
    status: inquiry.status,
    createdAt: inquiry.createdAt,
    updatedAt: inquiry.updatedAt,
  };
}

export async function submitOfficialInquiry(data) {
  const year = new Date().getFullYear();
  const referenceNumber = `INQ-${year}-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
  const inquiry = await officialInquiriesRepository.create({
    ...data,
    email: data.email || null,
    referenceNumber,
  });

  await writeAuditLog({
    action: 'submit',
    entityType: 'official_inquiry',
    entityId: inquiry.id,
    after: { referenceNumber, department: inquiry.department, inquiryType: inquiry.inquiryType },
  });

  return toPublicConfirmation(inquiry);
}

export async function listOfficialInquiries(query) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const { items, totalItems } = await officialInquiriesRepository.findMany({
    skip,
    take,
    status: query.status,
    search: query.search,
  });

  return { items, meta: buildPaginationMeta({ page, pageSize, totalItems }) };
}

export async function updateOfficialInquiryStatus(id, status, actorId) {
  const existing = await officialInquiriesRepository.findById(id);
  if (!existing) throw new NotFoundError('Official inquiry not found');

  const updated = await officialInquiriesRepository.update(id, { status });
  await writeAuditLog({
    actorId,
    action: 'status_change',
    entityType: 'official_inquiry',
    entityId: id,
    before: { status: existing.status },
    after: { status },
  });

  return updated;
}
