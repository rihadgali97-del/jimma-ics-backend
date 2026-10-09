import { mosquesRepository } from './mosques.repository.js';
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

const ENTITY_TYPE = 'mosque';
const TRANSLATED_FIELDS = ['name', 'description'];

function toPublic(mosque, translations, photos, locale, madrasaTranslations = {}, woredaTranslations = {}) {
  return {
    id: mosque.id,
    name: resolveLocale(translations?.name, locale),
    code: mosque.code,
    category: mosque.category,
    description: resolveLocale(translations?.description, locale),
    woreda: {
      id: mosque.woreda.id,
      code: mosque.woreda.code,
      name: resolveLocale(woredaTranslations?.name, locale),
    },
    latitude: mosque.latitude,
    longitude: mosque.longitude,
    capacity: mosque.capacity,
    hasWuduFacility: mosque.hasWuduFacility,
    hasBoarding: mosque.hasBoarding,
    madrasa: mosque.madrasa
      ? {
          id: mosque.madrasa.id,
          name: resolveLocale(madrasaTranslations[mosque.madrasa.id]?.name, locale),
        }
      : null,
    imamName: mosque.imamName,
    isPublished: mosque.isPublished,
    prayerTimes: mosque.prayerTimes.map((pt) => ({ prayerName: pt.prayerName, time: pt.time })),
    photos: [
      ...(photos ?? []).map((p) => ({ id: p.id, url: p.url })),
      ...(mosque.photoUrl ? [{ id: 0, url: mosque.photoUrl }] : []),
    ],
    createdAt: mosque.createdAt,
  };
}

export async function listMosques(query, { publicOnly }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const locale = query.locale ?? DEFAULT_LOCALE;

  let ids;
  if (query.search) {
    ids = await findEntityIdsByTranslatedSearch(ENTITY_TYPE, 'name', query.search);
    if (ids.length === 0) {
      return { items: [], meta: buildPaginationMeta({ page, pageSize, totalItems: 0 }) };
    }
  }

  const { items, totalItems } = await mosquesRepository.findMany({
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
  const photosById = new Map();
  for (const photo of await documentsRepository.findByEntities(ENTITY_TYPE, items.map((m) => m.id))) {
    const photos = photosById.get(photo.entityId) ?? [];
    photos.push(photo);
    photosById.set(photo.entityId, photos);
  }
  const madrasaTranslations = await getTranslationsForEntities(
    'madrasa',
    items.flatMap((mosque) => mosque.madrasa ? [mosque.madrasa.id] : []),
    ['name']
  );
  const woredaTranslations = await getTranslationsForEntities(
    'woreda',
    items.map((mosque) => mosque.woreda.id),
    ['name']
  );

  return {
    items: items.map((m) => toPublic(
      m,
      translations[m.id],
      photosById.get(m.id),
      locale,
      madrasaTranslations,
      woredaTranslations[m.woreda.id]
    )),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  };
}

export async function getMosque(id, locale = DEFAULT_LOCALE, { publicOnly } = {}) {
  const mosque = await mosquesRepository.findById(id);
  if (!mosque || (publicOnly && !mosque.isPublished)) {
    throw new NotFoundError('Mosque not found');
  }

  const translations = await getTranslationsForEntity(ENTITY_TYPE, id, TRANSLATED_FIELDS);
  const photos = await documentsRepository.findByEntity(ENTITY_TYPE, id);
  const madrasaTranslations = mosque.madrasa
    ? await getTranslationsForEntities('madrasa', [mosque.madrasa.id], ['name'])
    : {};
  const woredaTranslations = await getTranslationsForEntity('woreda', mosque.woreda.id, ['name']);

  return toPublic(mosque, translations, photos, locale, madrasaTranslations, woredaTranslations);
}

export async function createMosque({ name, description, madrasaId, ...fields }, actorId) {
  const woreda = await mosquesRepository.findWoredaById(fields.woredaId);
  if (!woreda) throw new BadRequestError('woredaId does not reference an existing woreda');
  if (woreda.isActive === false) throw new BadRequestError('New mosque records must use an active woreda');

  if (madrasaId != null) {
    const madrasa = await mosquesRepository.findMadrasaById(madrasaId);
    if (!madrasa) throw new BadRequestError('madrasaId does not reference an existing madrasa');
    if (madrasa.mosqueId != null) throw new BadRequestError('This madrasa is already linked to a mosque');
  }

  const mosque = await mosquesRepository.create(fields, madrasaId);

  await upsertTranslations(ENTITY_TYPE, mosque.id, { name, description });

  await writeAuditLog({
    actorId,
    action: 'create',
    entityType: ENTITY_TYPE,
    entityId: mosque.id,
    after: { ...fields, name, description, madrasaId: madrasaId ?? null },
  });

  return getMosque(mosque.id);
}

export async function updateMosque(id, { name, description, madrasaId, ...fields }, actorId) {
  const existing = await mosquesRepository.findById(id);
  if (!existing) throw new NotFoundError('Mosque not found');

  if (fields.woredaId) {
    const woreda = await mosquesRepository.findWoredaById(fields.woredaId);
    if (!woreda) throw new BadRequestError('woredaId does not reference an existing woreda');
    if (woreda.isActive === false && existing.woredaId !== fields.woredaId) {
      throw new BadRequestError('Mosques can only be reassigned to an active woreda');
    }
  }

  if (madrasaId != null && madrasaId !== existing.madrasa?.id) {
    const madrasa = await mosquesRepository.findMadrasaById(madrasaId);
    if (!madrasa) throw new BadRequestError('madrasaId does not reference an existing madrasa');
    if (madrasa.mosqueId != null && madrasa.mosqueId !== Number(id)) {
      throw new BadRequestError('This madrasa is already linked to another mosque');
    }
  }

  if (Object.keys(fields).length > 0) {
    await mosquesRepository.update(id, fields);
  }
  if (madrasaId !== undefined && madrasaId !== existing.madrasa?.id) {
    await mosquesRepository.setMadrasaForMosque(Number(id), madrasaId);
  }
  if (name || description) {
    await upsertTranslations(ENTITY_TYPE, id, { name, description });
  }

  await writeAuditLog({
    actorId,
    action: 'update',
    entityType: ENTITY_TYPE,
    entityId: id,
    after: { ...fields, name, description, ...(madrasaId !== undefined ? { madrasaId } : {}) },
  });

  return getMosque(id);
}

export async function deleteMosque(id, actorId) {
  const existing = await mosquesRepository.findById(id);
  if (!existing) throw new NotFoundError('Mosque not found');

  await mosquesRepository.delete(id);

  await writeAuditLog({ actorId, action: 'delete', entityType: ENTITY_TYPE, entityId: id });
}

export async function setPrayerTimes(mosqueId, prayerTimes, actorId) {
  const existing = await mosquesRepository.findById(mosqueId);
  if (!existing) throw new NotFoundError('Mosque not found');

  await mosquesRepository.upsertPrayerTimes(mosqueId, prayerTimes);

  await writeAuditLog({
    actorId,
    action: 'update',
    entityType: 'mosque_prayer_times',
    entityId: mosqueId,
    after: prayerTimes,
  });

  return getMosque(mosqueId);
}