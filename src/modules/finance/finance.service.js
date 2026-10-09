import { financeRepository } from './finance.repository.js';
import {
  upsertTranslations,
  getTranslationsForEntities,
  getTranslationsForEntity,
  resolveLocale,
  DEFAULT_LOCALE,
} from '../../common/services/translation.service.js';
import { documentsRepository } from '../documents/documents.repository.js';
import { NotFoundError } from '../../common/errors/httpErrors.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';

const ENTITY_TYPE = 'financial_report';
const TRANSLATED_FIELDS = ['title', 'summary'];

function toPublic(report, translations, documents, locale) {
  return {
    id: report.id,
    type: report.type,
    title: resolveLocale(translations?.title, locale),
    summary: resolveLocale(translations?.summary, locale),
    periodLabel: report.periodLabel,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    lineItems: report.lineItems.map((li) => ({
      category: li.category,
      amount: li.amount,
      notes: li.notes,
    })),
    documents: (documents ?? []).map((d) => ({ id: d.id, url: d.url, fileName: d.fileName })),
    createdAt: report.createdAt,
  };
}

export async function listFinancialReports(query, { publicOnly }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const locale = query.locale ?? DEFAULT_LOCALE;

  const { items, totalItems } = await financeRepository.findMany({
    skip,
    take,
    type: query.type,
    publicOnly,
  });

  const translations = await getTranslationsForEntities(
    ENTITY_TYPE,
    items.map((r) => r.id),
    TRANSLATED_FIELDS
  );

  return {
    items: items.map((r) => toPublic(r, translations[r.id], null, locale)),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  };
}

export async function getFinancialReport(id, locale = DEFAULT_LOCALE, { publicOnly } = {}) {
  const report = await financeRepository.findById(id);
  if (!report || (publicOnly && !report.isPublished)) {
    throw new NotFoundError('Financial report not found');
  }

  const translations = await getTranslationsForEntity(ENTITY_TYPE, id, TRANSLATED_FIELDS);
  const documents = await documentsRepository.findByEntity(ENTITY_TYPE, id);

  return toPublic(report, translations, documents, locale);
}

export async function createFinancialReport({ title, summary, lineItems, ...fields }, actorId) {
  const report = await financeRepository.create(fields);

  if (lineItems?.length) {
    await financeRepository.replaceLineItems(report.id, lineItems);
  }
  await upsertTranslations(ENTITY_TYPE, report.id, { title, summary });

  await writeAuditLog({
    actorId,
    action: 'create',
    entityType: ENTITY_TYPE,
    entityId: report.id,
    after: { ...fields, title, summary, lineItemCount: lineItems?.length ?? 0 },
  });

  return getFinancialReport(report.id, DEFAULT_LOCALE, { publicOnly: false });
}

export async function updateFinancialReport(id, { title, summary, lineItems, ...fields }, actorId) {
  const existing = await financeRepository.findById(id);
  if (!existing) throw new NotFoundError('Financial report not found');

  if (Object.keys(fields).length > 0) {
    await financeRepository.update(id, fields);
  }
  if (lineItems !== undefined) {
    await financeRepository.replaceLineItems(id, lineItems);
  }
  if (title || summary) {
    await upsertTranslations(ENTITY_TYPE, id, { title, summary });
  }

  await writeAuditLog({
    actorId,
    action: 'update',
    entityType: ENTITY_TYPE,
    entityId: id,
    after: { ...fields, title, summary, lineItemCount: lineItems?.length },
  });

  return getFinancialReport(id, DEFAULT_LOCALE, { publicOnly: false });
}

export async function deleteFinancialReport(id, actorId) {
  const existing = await financeRepository.findById(id);
  if (!existing) throw new NotFoundError('Financial report not found');

  await financeRepository.delete(id);

  await writeAuditLog({ actorId, action: 'delete', entityType: ENTITY_TYPE, entityId: id });
}