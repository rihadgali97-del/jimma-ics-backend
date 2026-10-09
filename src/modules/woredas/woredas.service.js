import { woredasRepository } from './woredas.repository.js';
import {
  upsertTranslations,
  getTranslationsForEntities,
  getTranslationsForEntity,
  resolveLocale,
  DEFAULT_LOCALE,
} from '../../common/services/translation.service.js';
import { NotFoundError, ConflictError } from '../../common/errors/httpErrors.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';

const ENTITY_TYPE = 'woreda';

function toPublic(woreda, translations, locale) {
  return {
    id: woreda.id,
    code: woreda.code,
    name: resolveLocale(translations?.name, locale),
    isActive: woreda.isActive,
    oromoName: woreda.oromoName,
    arabicName: woreda.arabicName,
    zone: woreda.zone,
    climateZone: woreda.climateZone,
    centerLatitude: woreda.centerLatitude,
    centerLongitude: woreda.centerLongitude,
    svgPath: woreda.svgPath,
    labelX: woreda.labelX,
    labelY: woreda.labelY,
    areaKm2: woreda.areaKm2,
    elevationMeters: woreda.elevationMeters,
    population: woreda.population,
    muslimPercentage: woreda.muslimPercentage,
    councilBranchHead: woreda.councilBranchHead,
    headContact: woreda.headContact,
    notableFeatures: woreda.notableFeatures,
  };
}

function normalizeDistrict(value) {
  return value?.trim().toLocaleLowerCase().replace(/[\s_-]+/g, ' ') ?? '';
}

export async function listWoredas(query, { includeInactive = false } = {}) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const locale = query.locale ?? DEFAULT_LOCALE;

  const { items, totalItems } = await woredasRepository.findMany({
    skip,
    take,
    activeOnly: !includeInactive,
  });
  const translations = await getTranslationsForEntities(
    ENTITY_TYPE,
    items.map((w) => w.id),
    ['name']
  );

  return {
    items: items.map((w) => toPublic(w, translations[w.id], locale)),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  };
}

export async function listWoredasGis(query) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const locale = query.locale ?? DEFAULT_LOCALE;
  const { items, totalItems } = await woredasRepository.findMany({
    skip,
    take,
    activeOnly: true,
  });
  const translations = await getTranslationsForEntities(
    ENTITY_TYPE,
    items.map((woreda) => woreda.id),
    ['name']
  );
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const nextYearStart = new Date(new Date().getFullYear() + 1, 0, 1);
  const records = await woredasRepository.findGisRelatedRecords(
    items.map((woreda) => woreda.id),
    yearStart,
    nextYearStart
  );

  const stats = new Map(items.map((woreda) => [woreda.id, {
    mosqueCount: 0,
    jummahMosqueCount: 0,
    madrasaCount: 0,
    studentCount: 0,
    waqfFeatures: [],
  }]));

  records.mosques.forEach((mosque) => {
    const woredaStats = stats.get(mosque.woredaId);
    if (!woredaStats) return;
    woredaStats.mosqueCount += 1;
    if (mosque.prayerTimes.length > 0) woredaStats.jummahMosqueCount += 1;
  });
  records.madrasas.forEach((madrasa) => {
    const woredaStats = stats.get(madrasa.woredaId);
    if (!woredaStats) return;
    woredaStats.madrasaCount += 1;
    woredaStats.studentCount += madrasa._count.students;
  });
  records.waqfAssets.forEach((asset) => {
    const woredaStats = stats.get(asset.woredaId);
    const label = asset.locationNote?.trim();
    if (woredaStats && label && !woredaStats.waqfFeatures.includes(label)) {
      woredaStats.waqfFeatures.push(label);
    }
  });

  const zakatByWoreda = new Map(items.map((woreda) => {
    const aliases = new Set([
      normalizeDistrict(woreda.code),
      normalizeDistrict(resolveLocale(translations[woreda.id]?.name, 'en')),
      normalizeDistrict(woreda.oromoName),
      normalizeDistrict(woreda.arabicName),
    ].filter(Boolean));
    const amount = records.distributions.reduce((sum, distribution) => {
      const districtNames = [distribution.district, distribution.woredaDistrict]
        .map(normalizeDistrict);
      return districtNames.some((district) => district && aliases.has(district))
        ? sum + Number(distribution.totalDisbursedETB)
        : sum;
    }, 0);
    return [woreda.id, amount];
  }));

  return {
    items: items.map((woreda) => {
      const names = translations[woreda.id];
      const woredaStats = stats.get(woreda.id);
      return {
        ...toPublic(woreda, names, locale),
        gisId: woreda.code,
        centerCoordinates: {
          lat: woreda.centerLatitude,
          lng: woreda.centerLongitude,
        },
        labelPos: { x: woreda.labelX, y: woreda.labelY },
        totalMosques: woredaStats.mosqueCount,
        jummahMosques: woredaStats.jummahMosqueCount,
        totalMadrasas: woredaStats.madrasaCount,
        tahfeezStudents: woredaStats.studentCount,
        annualZakatETB: zakatByWoreda.get(woreda.id) ?? 0,
        notableFeatures: [
          ...(Array.isArray(woreda.notableFeatures) ? woreda.notableFeatures : []),
          ...woredaStats.waqfFeatures,
        ],
      };
    }),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  };
}

export async function getWoreda(id, locale = DEFAULT_LOCALE, { includeInactive = false } = {}) {
  const woreda = await woredasRepository.findById(id);
  if (!woreda || (!includeInactive && woreda.isActive === false)) throw new NotFoundError('Woreda not found');

  const translations = await getTranslationsForEntity(ENTITY_TYPE, id, ['name']);
  return toPublic(woreda, translations, locale);
}

export async function createWoreda({ code, name, ...gisProfile }, actorId) {
  const existing = await woredasRepository.findByCode(code);
  if (existing) throw new ConflictError('A woreda with this code already exists');

  const woreda = await woredasRepository.create({ code, ...gisProfile });

  if (name) await upsertTranslations(ENTITY_TYPE, woreda.id, { name });

  await writeAuditLog({
    actorId,
    action: 'create',
    entityType: ENTITY_TYPE,
    entityId: woreda.id,
    after: { code, name },
  });

  return getWoreda(woreda.id);
}

export async function updateWoreda(id, { name, isActive, ...gisProfile }, actorId) {
  const woreda = await woredasRepository.findById(id);
  if (!woreda) throw new NotFoundError('Woreda not found');

  const beforeTranslations = name
    ? await getTranslationsForEntity(ENTITY_TYPE, id, ['name'])
    : {};
  if (name) await upsertTranslations(ENTITY_TYPE, id, { name });
  const updateData = {
    ...gisProfile,
    ...(isActive !== undefined ? { isActive } : {}),
  };
  if (Object.keys(updateData).length > 0) await woredasRepository.update(id, updateData);

  const profileFields = Object.keys(gisProfile);
  await writeAuditLog({
    actorId,
    action: 'update',
    entityType: ENTITY_TYPE,
    entityId: id,
    before: {
      ...(name ? { name: resolveLocale(beforeTranslations.name, DEFAULT_LOCALE) } : {}),
      isActive: woreda.isActive,
      ...Object.fromEntries(profileFields.map((field) => [field, woreda[field]])),
    },
    after: {
      ...(name ? { name: resolveLocale(name, DEFAULT_LOCALE) } : {}),
      isActive: isActive ?? woreda.isActive,
      ...gisProfile,
    },
  });

  return getWoreda(id, DEFAULT_LOCALE, { includeInactive: true });
}