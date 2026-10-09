import { waqfRepository } from './waqf.repository.js';
import {
  upsertTranslations,
  getTranslationsForEntities,
  getTranslationsForEntity,
  resolveLocale,
  DEFAULT_LOCALE,
} from '../../common/services/translation.service.js';
import { documentsRepository } from '../documents/documents.repository.js';
import { NotFoundError, BadRequestError } from '../../common/errors/httpErrors.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';

const ENTITY_TYPE = 'waqf_asset';
const TRANSLATED_FIELDS = ['name', 'description'];

// Public transparency view intentionally omits tenantName, tenantContact,
// and monthlyIncome — the requirements doc calls for a "summarized" public
// view, not full financial/tenant detail. Those fields only appear in the
// admin view below.
function toPublicSummary(asset, translations, locale) {
  return {
    id: asset.id,
    name: resolveLocale(translations?.name, locale),
    description: resolveLocale(translations?.description, locale),
    type: asset.type,
    status: asset.status,
    woreda: { id: asset.woreda.id, code: asset.woreda.code },
    locationNote: asset.locationNote,
    createdAt: asset.createdAt,
  };
}

function toAdminView(asset, translations, photos, locale) {
  return {
    ...toPublicSummary(asset, translations, locale),
    monthlyIncome: asset.monthlyIncome,
    tenantName: asset.tenantName,
    tenantContact: asset.tenantContact,
    isPublished: asset.isPublished,
    documents: (photos ?? []).map((d) => ({ id: d.id, url: d.url, fileName: d.fileName, mimeType: d.mimeType })),
    updatedAt: asset.updatedAt,
  };
}

export async function listWaqfAssets(query, { publicOnly }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const locale = query.locale ?? DEFAULT_LOCALE;

  const { items, totalItems } = await waqfRepository.findMany({
    skip,
    take,
    woredaId: query.woredaId,
    type: query.type,
    publicOnly,
  });

  const translations = await getTranslationsForEntities(
    ENTITY_TYPE,
    items.map((a) => a.id),
    TRANSLATED_FIELDS
  );

  const adminDocuments = publicOnly ? [] : await Promise.all(items.map((a) => documentsRepository.findByEntity(ENTITY_TYPE, a.id)));

  return {
    items: items.map((a, index) => publicOnly ? toPublicSummary(a, translations[a.id], locale) : toAdminView(a, translations[a.id], adminDocuments[index], locale)),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  };
}

export async function getWaqfAsset(id, locale = DEFAULT_LOCALE, { publicOnly } = {}) {
  const asset = await waqfRepository.findById(id);
  if (!asset || (publicOnly && !asset.isPublished)) {
    throw new NotFoundError('Waqf asset not found');
  }

  const translations = await getTranslationsForEntity(ENTITY_TYPE, id, TRANSLATED_FIELDS);

  if (publicOnly) {
    return toPublicSummary(asset, translations, locale);
  }

  const documents = await documentsRepository.findByEntity(ENTITY_TYPE, id);
  return toAdminView(asset, translations, documents, locale);
}

export async function createWaqfAsset({ name, description, ...fields }, actorId) {
  const woreda = await waqfRepository.findWoredaById(fields.woredaId);
  if (!woreda) throw new BadRequestError('woredaId does not reference an existing woreda');
  if (woreda.isActive === false) throw new BadRequestError('New Waqf assets must use an active woreda');

  const asset = await waqfRepository.create(fields);

  await upsertTranslations(ENTITY_TYPE, asset.id, { name, description });

  await writeAuditLog({
    actorId,
    action: 'create',
    entityType: ENTITY_TYPE,
    entityId: asset.id,
    after: { ...fields, name, description },
  });

  return getWaqfAsset(asset.id, DEFAULT_LOCALE, { publicOnly: false });
}

export async function updateWaqfAsset(id, { name, description, ...fields }, actorId) {
  const existing = await waqfRepository.findById(id);
  if (!existing) throw new NotFoundError('Waqf asset not found');

  if (fields.woredaId) {
    const woreda = await waqfRepository.findWoredaById(fields.woredaId);
    if (!woreda) throw new BadRequestError('woredaId does not reference an existing woreda');
    if (woreda.isActive === false && existing.woredaId !== fields.woredaId) {
      throw new BadRequestError('Waqf assets can only be reassigned to an active woreda');
    }
  }

  if (Object.keys(fields).length > 0) {
    await waqfRepository.update(id, fields);
  }
  if (name || description) {
    await upsertTranslations(ENTITY_TYPE, id, { name, description });
  }

  await writeAuditLog({
    actorId,
    action: 'update',
    entityType: ENTITY_TYPE,
    entityId: id,
    after: { ...fields, name, description },
  });

  return getWaqfAsset(id, DEFAULT_LOCALE, { publicOnly: false });
}

export async function deleteWaqfAsset(id, actorId) {
  const existing = await waqfRepository.findById(id);
  if (!existing) throw new NotFoundError('Waqf asset not found');

  await waqfRepository.delete(id);

  await writeAuditLog({ actorId, action: 'delete', entityType: ENTITY_TYPE, entityId: id });
}
