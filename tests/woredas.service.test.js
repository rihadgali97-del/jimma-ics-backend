import { jest } from '@jest/globals';

const repository = {
  findMany: jest.fn(),
  findById: jest.fn(),
  findByCode: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findGisRelatedRecords: jest.fn(),
};
const getTranslationsForEntities = jest.fn();
const getTranslationsForEntity = jest.fn();
const upsertTranslations = jest.fn();
const writeAuditLog = jest.fn();

jest.unstable_mockModule('../src/modules/woredas/woredas.repository.js', () => ({
  woredasRepository: repository,
}));
jest.unstable_mockModule('../src/common/services/translation.service.js', () => ({
  upsertTranslations,
  getTranslationsForEntities,
  getTranslationsForEntity,
  resolveLocale: (values, locale) => values?.[locale] ?? null,
  DEFAULT_LOCALE: 'en',
}));
jest.unstable_mockModule('../src/common/utils/auditLog.js', () => ({ writeAuditLog }));

const { listWoredas, listWoredasGis, updateWoreda } = await import('../src/modules/woredas/woredas.service.js');

beforeEach(() => jest.clearAllMocks());

describe('Woreda registry', () => {
  it('limits the public list to active woredas', async () => {
    repository.findMany.mockResolvedValue({
      items: [{ id: 3, code: 'agaro', isActive: true }],
      totalItems: 1,
    });
    getTranslationsForEntities.mockResolvedValue({});

    const result = await listWoredas({});

    expect(repository.findMany).toHaveBeenCalledWith({ skip: 0, take: 20, activeOnly: true });
    expect(result.items[0]).toMatchObject({ id: 3, code: 'agaro', isActive: true });
  });

  it('includes inactive woredas in the authenticated administrative list', async () => {
    repository.findMany.mockResolvedValue({
      items: [{ id: 3, code: 'agaro', isActive: true }, { id: 4, code: 'sigmo', isActive: false }],
      totalItems: 2,
    });
    getTranslationsForEntities.mockResolvedValue({});

    const result = await listWoredas({}, { includeInactive: true });

    expect(repository.findMany).toHaveBeenCalledWith({ skip: 0, take: 20, activeOnly: false });
    expect(result.items.map((woreda) => woreda.isActive)).toEqual([true, false]);
  });

  it('builds GIS counts from linked directory records and annual distributions', async () => {
    repository.findMany.mockResolvedValue({
      items: [{
        id: 3,
        code: 'agaro',
        isActive: true,
        population: 180000,
        notableFeatures: ['Agaro market'],
      }],
      totalItems: 1,
    });
    getTranslationsForEntities.mockResolvedValue({ 3: { name: { en: 'Agaro' } } });
    repository.findGisRelatedRecords.mockResolvedValue({
      mosques: [
        { woredaId: 3, prayerTimes: [{ id: 1 }] },
        { woredaId: 3, prayerTimes: [] },
      ],
      madrasas: [{ woredaId: 3, _count: { students: 42 } }],
      distributions: [
        { district: 'Agaro', woredaDistrict: null, totalDisbursedETB: '1250.50' },
        { district: 'Other', woredaDistrict: null, totalDisbursedETB: '9999' },
      ],
      waqfAssets: [{ woredaId: 3, locationNote: 'Agaro Waqf land' }],
    });

    const result = await listWoredasGis({});

    expect(result.items[0]).toMatchObject({
      gisId: 'agaro',
      totalMosques: 2,
      jummahMosques: 1,
      totalMadrasas: 1,
      tahfeezStudents: 42,
      annualZakatETB: 1250.5,
      notableFeatures: ['Agaro market', 'Agaro Waqf land'],
    });
    expect(repository.findGisRelatedRecords).toHaveBeenCalledWith(
      [3],
      expect.any(Date),
      expect.any(Date)
    );
  });

  it('deactivates a woreda without deleting its record and audits the change', async () => {
    repository.findById
      .mockResolvedValueOnce({ id: 4, code: 'sigmo', isActive: true })
      .mockResolvedValueOnce({ id: 4, code: 'sigmo', isActive: false });
    repository.update.mockResolvedValue({ id: 4, code: 'sigmo', isActive: false });
    getTranslationsForEntities.mockResolvedValue({});
    getTranslationsForEntity.mockResolvedValue({});

    const result = await updateWoreda(4, { isActive: false }, 9);

    expect(repository.update).toHaveBeenCalledWith(4, { isActive: false });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 9,
      action: 'update',
      entityType: 'woreda',
      entityId: 4,
      before: { isActive: true },
      after: { isActive: false },
    }));
    expect(result.isActive).toBe(false);
  });
});
