import { jest } from '@jest/globals';

const mosque = {
  id: 10,
  woreda: { id: 3, code: 'agaro' },
  prayerTimes: [],
  madrasa: null,
  photoUrl: null,
  latitude: null,
  longitude: null,
  capacity: 500,
  hasWuduFacility: true,
  hasBoarding: false,
  imamName: 'Imam',
  isPublished: true,
};
const madrasa = {
  id: 20,
  woreda: { id: 3, code: 'agaro' },
  photoUrl: null,
  mosqueId: null,
  latitude: null,
  longitude: null,
  capacity: 120,
  hasBoarding: false,
  headTeacherId: null,
  headTeacher: null,
  hifzGraduatesCount: 0,
  isPublished: true,
};
const mosqueRepository = { findMany: jest.fn(), findById: jest.fn() };
const madrasaRepository = { findMany: jest.fn(), findById: jest.fn() };
const findDocumentsByEntities = jest.fn();
const findDocumentsByEntity = jest.fn();
const getTranslationsForEntities = jest.fn(async (entityType, entityIds) => {
  if (entityType !== 'woreda') return {};
  return Object.fromEntries(entityIds.map((id) => [id, { name: { en: 'Agaro Town' } }]));
});
const getTranslationsForEntity = jest.fn(async () => ({}));
const resolveLocale = jest.fn((values, locale) => values?.[locale] ?? null);

jest.unstable_mockModule('../src/modules/mosques/mosques.repository.js', () => ({
  mosquesRepository: mosqueRepository,
}));
jest.unstable_mockModule('../src/modules/madrasas/madrasas.repository.js', () => ({
  madrasasRepository: madrasaRepository,
}));
jest.unstable_mockModule('../src/modules/documents/documents.repository.js', () => ({
  documentsRepository: {
    findByEntities: findDocumentsByEntities,
    findByEntity: findDocumentsByEntity,
  },
}));
jest.unstable_mockModule('../src/common/services/translation.service.js', () => ({
  upsertTranslations: jest.fn(),
  getTranslationsForEntities,
  getTranslationsForEntity,
  resolveLocale,
  findEntityIdsByTranslatedSearch: jest.fn(),
  DEFAULT_LOCALE: 'en',
}));

const { listMosques } = await import('../src/modules/mosques/mosques.service.js');
const { listMadrasas } = await import('../src/modules/madrasas/madrasas.service.js');

beforeEach(() => {
  jest.clearAllMocks();
  mosqueRepository.findMany.mockResolvedValue({ items: [mosque], totalItems: 1 });
  madrasaRepository.findMany.mockResolvedValue({ items: [madrasa], totalItems: 1 });
  findDocumentsByEntities.mockResolvedValue([]);
});

describe('directory woreda names', () => {
  it('returns the translated woreda name with mosque records', async () => {
    const result = await listMosques({}, { publicOnly: true });

    expect(result.items[0].woreda).toEqual({ id: 3, code: 'agaro', name: 'Agaro Town' });
    expect(getTranslationsForEntities).toHaveBeenCalledWith('woreda', [3], ['name']);
  });

  it('returns the translated woreda name with madrasa records', async () => {
    const result = await listMadrasas({}, { publicOnly: true });

    expect(result.items[0].woreda).toEqual({ id: 3, code: 'agaro', name: 'Agaro Town' });
    expect(getTranslationsForEntities).toHaveBeenCalledWith('woreda', [3], ['name']);
  });
});
