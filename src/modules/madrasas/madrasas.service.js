import { madrasasRepository } from './madrasas.repository.js';
import {
  upsertTranslations,
  getTranslationsForEntities,
  getTranslationsForEntity,
  resolveLocale,
  findEntityIdsByTranslatedSearch,
  DEFAULT_LOCALE,
} from '../../common/services/translation.service.js';
import { documentsRepository } from '../documents/documents.repository.js';
import { NotFoundError, BadRequestError } from '../../common/errors/httpErrors.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';

const ENTITY_TYPE = 'madrasa';
const TRANSLATED_FIELDS = ['name', 'description'];

function toPublic(madrasa, translations, photos, locale, woredaTranslations = {}) {
  return {
    id: madrasa.id,
    name: resolveLocale(translations?.name, locale),
    description: resolveLocale(translations?.description, locale),
    woreda: {
      id: madrasa.woreda.id,
      code: madrasa.woreda.code,
      name: resolveLocale(woredaTranslations?.name, locale),
    },
    mosqueId: madrasa.mosqueId,
    latitude: madrasa.latitude,
    longitude: madrasa.longitude,
    capacity: madrasa.capacity,
    hasBoarding: madrasa.hasBoarding,
    headTeacherId: madrasa.headTeacherId,
    headTeacher: madrasa.headTeacher?.name ?? null,
    hifzGraduatesCount: madrasa.hifzGraduatesCount,
    isPublished: madrasa.isPublished,
    photos: [
      ...(photos ?? []).map((p) => ({ id: p.id, url: p.url })),
      ...(madrasa.photoUrl ? [{ id: 0, url: madrasa.photoUrl }] : []),
    ],
    createdAt: madrasa.createdAt,
  };
}

export async function listMadrasas(query, { publicOnly }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const locale = query.locale ?? DEFAULT_LOCALE;

  let ids;
  if (query.search) {
    ids = await findEntityIdsByTranslatedSearch(ENTITY_TYPE, 'name', query.search);
    if (ids.length === 0) {
      return { items: [], meta: buildPaginationMeta({ page, pageSize, totalItems: 0 }) };
    }
  }

  const { items, totalItems } = await madrasasRepository.findMany({
    skip,
    take,
    woredaId: query.woredaId,
    ids,
    publicOnly,
  });

  const translations = await getTranslationsForEntities(
    ENTITY_TYPE,
    items.map((m) => m.id),
    TRANSLATED_FIELDS
  );
  const woredaTranslations = await getTranslationsForEntities(
    'woreda',
    items.map((madrasa) => madrasa.woreda.id),
    ['name']
  );
  const photosById = new Map();
  for (const photo of await documentsRepository.findByEntities(ENTITY_TYPE, items.map((m) => m.id))) {
    const photos = photosById.get(photo.entityId) ?? [];
    photos.push(photo);
    photosById.set(photo.entityId, photos);
  }

  return {
    items: items.map((m) => toPublic(m, translations[m.id], photosById.get(m.id), locale, woredaTranslations[m.woreda.id])),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  };
}

export async function getMadrasa(id, locale = DEFAULT_LOCALE, { publicOnly } = {}) {
  const madrasa = await madrasasRepository.findById(id);
  if (!madrasa || (publicOnly && !madrasa.isPublished)) {
    throw new NotFoundError('Madrasa not found');
  }

  const translations = await getTranslationsForEntity(ENTITY_TYPE, id, TRANSLATED_FIELDS);
  const woredaTranslations = await getTranslationsForEntity('woreda', madrasa.woreda.id, ['name']);
  const photos = await documentsRepository.findByEntity(ENTITY_TYPE, id);

  return toPublic(madrasa, translations, photos, locale, woredaTranslations);
}

export async function createMadrasa({ name, description, ...fields }, actorId) {
  const woreda = await madrasasRepository.findWoredaById(fields.woredaId);
  if (!woreda) throw new BadRequestError('woredaId does not reference an existing woreda');
  if (woreda.isActive === false) throw new BadRequestError('New madrasa records must use an active woreda');

  const madrasa = await madrasasRepository.create(fields);

  await upsertTranslations(ENTITY_TYPE, madrasa.id, { name, description });

  await writeAuditLog({
    actorId,
    action: 'create',
    entityType: ENTITY_TYPE,
    entityId: madrasa.id,
    after: { ...fields, name, description },
  });

  return getMadrasa(madrasa.id);
}

export async function updateMadrasa(id, { name, description, ...fields }, actorId) {
  const existing = await madrasasRepository.findById(id);
  if (!existing) throw new NotFoundError('Madrasa not found');

  if (fields.headTeacherId) {
    const teacher = await madrasasRepository.findTeacherById(fields.headTeacherId);
    if (!teacher || teacher.madrasaId !== Number(id)) {
      throw new BadRequestError('Head teacher must be an existing teacher assigned to this madrasa');
    }
  }

  if (fields.woredaId) {
    const woreda = await madrasasRepository.findWoredaById(fields.woredaId);
    if (!woreda) throw new BadRequestError('woredaId does not reference an existing woreda');
    if (woreda.isActive === false && existing.woredaId !== fields.woredaId) {
      throw new BadRequestError('Madrasas can only be reassigned to an active woreda');
    }
  }

  if (Object.keys(fields).length > 0) {
    await madrasasRepository.update(id, fields);
  }
  if (name || description) {
    await upsertTranslations(ENTITY_TYPE, id, { name, description });
  }

  await writeAuditLog({
    actorId,
    action: 'update',
    entityType: ENTITY_TYPE,
    entityId: id,
    before: {
      headTeacherId: existing.headTeacherId,
      hifzGraduatesCount: existing.hifzGraduatesCount,
    },
    after: { ...fields, name, description },
  });

  return getMadrasa(id);
}

export async function deleteMadrasa(id, actorId) {
  const existing = await madrasasRepository.findById(id);
  if (!existing) throw new NotFoundError('Madrasa not found');

  await madrasasRepository.delete(id);

  await writeAuditLog({ actorId, action: 'delete', entityType: ENTITY_TYPE, entityId: id });
}