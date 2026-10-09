import { leadershipRepository } from './leadership.repository.js';
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

const ENTITY_TYPE = 'leadership_profile';
const TRANSLATED_FIELDS = ['name', 'role', 'bio'];

function toPublic(p, translations, photo, locale) {
  return {
    id: p.id,
    name: resolveLocale(translations?.name, locale),
    role: resolveLocale(translations?.role, locale),
    bio: resolveLocale(translations?.bio, locale),
    displayOrder: p.displayOrder,
    photoUrl: photo?.url ?? null,
  };
}

export async function listLeadership(query, { publicOnly }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const locale = query.locale ?? DEFAULT_LOCALE;

  const { items, totalItems } = await leadershipRepository.findMany({ skip, take, publicOnly });

  const translations = await getTranslationsForEntities(
    ENTITY_TYPE,
    items.map((p) => p.id),
    TRANSLATED_FIELDS
  );

  return {
    items: items.map((p) => toPublic(p, translations[p.id], null, locale)),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  };
}

export async function getLeadershipProfile(id, locale = DEFAULT_LOCALE, { publicOnly } = {}) {
  const profile = await leadershipRepository.findById(id);
  if (!profile || (publicOnly && !profile.isPublished)) {
    throw new NotFoundError('Leadership profile not found');
  }

  const translations = await getTranslationsForEntity(ENTITY_TYPE, id, TRANSLATED_FIELDS);
  const photos = await documentsRepository.findByEntity(ENTITY_TYPE, id);

  return toPublic(profile, translations, photos[0], locale);
}

export async function createLeadershipProfile({ name, role, bio, ...fields }, actorId) {
  const profile = await leadershipRepository.create(fields);
  await upsertTranslations(ENTITY_TYPE, profile.id, { name, role, bio });

  await writeAuditLog({
    actorId,
    action: 'create',
    entityType: ENTITY_TYPE,
    entityId: profile.id,
    after: { ...fields, name, role, bio },
  });

  return getLeadershipProfile(profile.id, DEFAULT_LOCALE, { publicOnly: false });
}

export async function updateLeadershipProfile(id, { name, role, bio, ...fields }, actorId) {
  const existing = await leadershipRepository.findById(id);
  if (!existing) throw new NotFoundError('Leadership profile not found');

  if (Object.keys(fields).length > 0) {
    await leadershipRepository.update(id, fields);
  }
  if (name || role || bio) {
    await upsertTranslations(ENTITY_TYPE, id, { name, role, bio });
  }

  await writeAuditLog({
    actorId,
    action: 'update',
    entityType: ENTITY_TYPE,
    entityId: id,
    after: { ...fields, name, role, bio },
  });

  return getLeadershipProfile(id, DEFAULT_LOCALE, { publicOnly: false });
}

export async function deleteLeadershipProfile(id, actorId) {
  const existing = await leadershipRepository.findById(id);
  if (!existing) throw new NotFoundError('Leadership profile not found');

  await leadershipRepository.delete(id);

  await writeAuditLog({ actorId, action: 'delete', entityType: ENTITY_TYPE, entityId: id });
}