import { fatwasRepository } from './fatwas.repository.js';
import {
  upsertTranslations,
  getTranslationsForEntities,
  getTranslationsForEntity,
  resolveLocale,
  findEntityIdsByTranslatedSearch,
  DEFAULT_LOCALE,
} from '../../common/services/translation.service.js';
import { NotFoundError } from '../../common/errors/httpErrors.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';

const ENTITY_TYPE = 'fatwa';
const TRANSLATED_FIELDS = ['question', 'ruling'];

function toPublic(f, translations, locale) {
  return {
    id: f.id,
    category: f.category,
    question: resolveLocale(translations?.question, locale),
    ruling: resolveLocale(translations?.ruling, locale),
    publishedAt: f.publishedAt,
  };
}

export async function listFatwas(query, { publicOnly }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const locale = query.locale ?? DEFAULT_LOCALE;

  let ids;
  if (query.search) {
    // Search both question and ruling text, union the matches.
    const [questionIds, rulingIds] = await Promise.all([
      findEntityIdsByTranslatedSearch(ENTITY_TYPE, 'question', query.search),
      findEntityIdsByTranslatedSearch(ENTITY_TYPE, 'ruling', query.search),
    ]);
    ids = [...new Set([...questionIds, ...rulingIds])];
    if (ids.length === 0) {
      return { items: [], meta: buildPaginationMeta({ page, pageSize, totalItems: 0 }) };
    }
  }

  const { items, totalItems } = await fatwasRepository.findMany({
    skip,
    take,
    category: query.category,
    ids,
    publicOnly,
  });

  const translations = await getTranslationsForEntities(
    ENTITY_TYPE,
    items.map((f) => f.id),
    TRANSLATED_FIELDS
  );

  return {
    items: items.map((f) => toPublic(f, translations[f.id], locale)),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  };
}

export async function getFatwa(id, locale = DEFAULT_LOCALE, { publicOnly } = {}) {
  const fatwa = await fatwasRepository.findById(id);
  if (!fatwa || (publicOnly && !fatwa.isPublished)) {
    throw new NotFoundError('Fatwa not found');
  }

  const translations = await getTranslationsForEntity(ENTITY_TYPE, id, TRANSLATED_FIELDS);
  return toPublic(fatwa, translations, locale);
}

export async function createFatwa({ question, ruling, ...fields }, actorId) {
  const fatwa = await fatwasRepository.create(fields);
  await upsertTranslations(ENTITY_TYPE, fatwa.id, { question, ruling });

  await writeAuditLog({
    actorId,
    action: 'create',
    entityType: ENTITY_TYPE,
    entityId: fatwa.id,
    after: { ...fields, question, ruling },
  });

  return getFatwa(fatwa.id, DEFAULT_LOCALE, { publicOnly: false });
}

export async function updateFatwa(id, { question, ruling, ...fields }, actorId) {
  const existing = await fatwasRepository.findById(id);
  if (!existing) throw new NotFoundError('Fatwa not found');

  if (Object.keys(fields).length > 0) {
    await fatwasRepository.update(id, fields);
  }
  if (question || ruling) {
    await upsertTranslations(ENTITY_TYPE, id, { question, ruling });
  }

  await writeAuditLog({
    actorId,
    action: 'update',
    entityType: ENTITY_TYPE,
    entityId: id,
    after: { ...fields, question, ruling },
  });

  return getFatwa(id, DEFAULT_LOCALE, { publicOnly: false });
}

export async function deleteFatwa(id, actorId) {
  const existing = await fatwasRepository.findById(id);
  if (!existing) throw new NotFoundError('Fatwa not found');

  await fatwasRepository.delete(id);

  await writeAuditLog({ actorId, action: 'delete', entityType: ENTITY_TYPE, entityId: id });
}