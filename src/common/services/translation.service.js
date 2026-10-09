import { prisma } from '../../config/database.js';

// Every multilingual entity (mosques, madrasas, and later announcements,
// events, fatwas, leadership, waqf...) stores its translatable fields here
// instead of getting its own name_en/name_am/... columns. This service is
// the one place that knows how to read/write that table.

export const SUPPORTED_LOCALES = ['en', 'am', 'om', 'ar'];
export const DEFAULT_LOCALE = 'en';

/**
 * Upsert translations for one entity.
 * fieldsMap shape: { name: { en: 'Foo', am: '...' }, description: { en: '...' } }
 * Locales/fields not present in fieldsMap are left untouched.
 */
export async function upsertTranslations(entityType, entityId, fieldsMap) {
  const ops = [];

  for (const [field, localeValues] of Object.entries(fieldsMap ?? {})) {
    for (const [locale, value] of Object.entries(localeValues ?? {})) {
      if (value === undefined || value === null) continue;
      ops.push(
        prisma.translation.upsert({
          where: {
            entityType_entityId_field_locale: { entityType, entityId, field, locale },
          },
          update: { value },
          create: { entityType, entityId, field, locale, value },
        })
      );
    }
  }

  if (ops.length > 0) {
    await prisma.$transaction(ops);
  }
}

/**
 * Fetch translations for many entities of the same type at once (avoids
 * N+1 queries in list endpoints). Returns:
 *   { [entityId]: { [field]: { [locale]: value } } }
 */
export async function getTranslationsForEntities(entityType, entityIds, fields) {
  if (!entityIds || entityIds.length === 0) return {};

  const rows = await prisma.translation.findMany({
    where: { entityType, entityId: { in: entityIds }, field: { in: fields } },
  });

  const map = {};
  for (const row of rows) {
    map[row.entityId] ??= {};
    map[row.entityId][row.field] ??= {};
    map[row.entityId][row.field][row.locale] = row.value;
  }
  return map;
}

export async function getTranslationsForEntity(entityType, entityId, fields) {
  const map = await getTranslationsForEntities(entityType, [entityId], fields);
  return map[entityId] ?? {};
}

/**
 * Picks the best available value for a locale: exact match, then the
 * default locale, then whatever is available — so a record missing an
 * Arabic translation still renders something instead of a blank field.
 */
export function resolveLocale(translationsForField, locale) {
  if (!translationsForField) return null;
  return (
    translationsForField[locale] ??
    translationsForField[DEFAULT_LOCALE] ??
    Object.values(translationsForField)[0] ??
    null
  );
}

/** Flattens a { field: { locale: value } } map to { field: resolvedValue } for one locale. */
export function resolveEntityTranslations(entityTranslations, fields, locale) {
  const resolved = {};
  for (const field of fields) {
    resolved[field] = resolveLocale(entityTranslations?.[field], locale);
  }
  return resolved;
}

export async function deleteTranslations(entityType, entityId) {
  await prisma.translation.deleteMany({ where: { entityType, entityId } });
}

/** Entity IDs whose translated `field` contains `search` (case-insensitive via MySQL's default collation). */
export async function findEntityIdsByTranslatedSearch(entityType, field, search) {
  const rows = await prisma.translation.findMany({
    where: { entityType, field, value: { contains: search } },
    select: { entityId: true },
  });
  return [...new Set(rows.map((r) => r.entityId))];
}