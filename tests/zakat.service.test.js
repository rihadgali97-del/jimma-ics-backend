import { jest } from '@jest/globals';

const mockRepository = {
  findWoredaById: jest.fn(),
  create: jest.fn(),
  findByReference: jest.fn(),
  findCurrentNisabRate: jest.fn(),
  deleteAssessment: jest.fn(),
};
const mockWriteAuditLog = jest.fn();
const mockGenerateReferenceNumber = jest.fn();
const mockGetCivicServiceAvailability = jest.fn();

jest.unstable_mockModule('../src/modules/zakat/zakat.repository.js', () => ({
  zakatRepository: mockRepository,
}));
jest.unstable_mockModule('../src/common/utils/auditLog.js', () => ({
  writeAuditLog: mockWriteAuditLog,
}));
jest.unstable_mockModule('../src/common/services/referenceNumber.service.js', () => ({
  generateReferenceNumber: mockGenerateReferenceNumber,
  SERVICE_CODES: { zakat: 'ZKT' },
}));
jest.unstable_mockModule('../src/modules/civic-services/civic-services.service.js', () => ({
  getCivicServiceAvailability: mockGetCivicServiceAvailability,
}));

const zakatService = await import('../src/modules/zakat/zakat.service.js');

const application = {
  id: 12,
  referenceNumber: 'ZKT-2026-00012',
  status: 'SUBMITTED',
  woreda: { id: 3, code: 'JIMMA-TOWN' },
  applicantFullName: 'Amina Ahmed',
  applicantPhone: '+251911234567',
  householdSize: 5,
  eligibilityNotes: 'Needs assessment',
  assignedOfficer: { id: 7, fullName: 'Case Officer' },
  createdAt: new Date('2026-10-01T10:00:00.000Z'),
  updatedAt: new Date('2026-10-01T10:00:00.000Z'),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCivicServiceAvailability.mockResolvedValue({ serviceKey: 'srv-2', isEnabled: true });
});

describe('Zakat application service', () => {
  it('rejects new applications when public Zakat intake is disabled', async () => {
    mockGetCivicServiceAvailability.mockResolvedValue({ serviceKey: 'srv-2', isEnabled: false });

    await expect(zakatService.submitZakatApplication({ woredaId: 3 })).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(mockRepository.findWoredaById).not.toHaveBeenCalled();
    expect(mockRepository.create).not.toHaveBeenCalled();
  });

  it('rejects submissions for an unknown woreda without creating a record', async () => {
    mockRepository.findWoredaById.mockResolvedValue(null);

    await expect(zakatService.submitZakatApplication({ woredaId: 999 })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockRepository.create).not.toHaveBeenCalled();
  });

  it('rejects submissions for an inactive woreda', async () => {
    mockRepository.findWoredaById.mockResolvedValue({ id: 3, code: 'JIMMA-TOWN', isActive: false });

    await expect(zakatService.submitZakatApplication({ woredaId: 3 })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockRepository.create).not.toHaveBeenCalled();
  });

  it('creates an application with a reference number and writes an audit record', async () => {
    mockRepository.findWoredaById.mockResolvedValue({ id: 3, code: 'JIMMA-TOWN' });
    mockGenerateReferenceNumber.mockResolvedValue('ZKT-2026-00012');
    mockRepository.create.mockResolvedValue(application);

    const result = await zakatService.submitZakatApplication({
      woredaId: 3,
      applicantFullName: 'Amina Ahmed',
      applicantPhone: '+251911234567',
      householdSize: 5,
    });

    expect(result.referenceNumber).toBe('ZKT-2026-00012');
    expect(result.status).toBe('SUBMITTED');
    expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      woredaId: 3,
      referenceNumber: 'ZKT-2026-00012',
    }));
    expect(mockWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'submit',
      entityType: 'zakat_application',
      entityId: 12,
    }));
  });

  it('requires the applicant phone to match and returns a minimal public tracking view', async () => {
    mockRepository.findByReference.mockResolvedValue(application);

    await expect(
      zakatService.trackZakatApplication('ZKT-2026-00012', '+251900000000')
    ).rejects.toMatchObject({ statusCode: 404 });

    const result = await zakatService.trackZakatApplication('ZKT-2026-00012', '+251911234567');
    expect(result).toEqual({
      referenceNumber: 'ZKT-2026-00012',
      status: 'SUBMITTED',
      applicantFullName: 'Amina Ahmed',
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    });
    expect(result).not.toHaveProperty('eligibilityNotes');
    expect(result).not.toHaveProperty('assignedOfficer');
  });
});

describe('Nisab rate service', () => {
  it('returns null when the administrator has not set a rate', async () => {
    mockRepository.findCurrentNisabRate.mockResolvedValue(null);
    await expect(zakatService.getCurrentNisabRate()).resolves.toBeNull();
  });

  it('returns the latest stored gold and silver prices', async () => {
    const effectiveDate = new Date('2026-10-02T00:00:00.000Z');
    mockRepository.findCurrentNisabRate.mockResolvedValue({
      goldPricePerGram: 12500,
      silverPricePerGram: 160,
      effectiveDate,
    });

    await expect(zakatService.getCurrentNisabRate()).resolves.toEqual({
      goldPricePerGram: 12500,
      silverPricePerGram: 160,
      effectiveDate,
    });
  });
});

describe('Saved Zakat assessments', () => {
  it('coerces the string assessment ID used by the frontend before deleting', async () => {
    mockRepository.deleteAssessment.mockResolvedValue({ count: 1 });

    await expect(zakatService.deleteAssessment(4, '17')).resolves.toBeUndefined();
    expect(mockRepository.deleteAssessment).toHaveBeenCalledWith(17, 4);
  });

  it('does not allow a user to delete another user’s assessment', async () => {
    mockRepository.deleteAssessment.mockResolvedValue({ count: 0 });

    await expect(zakatService.deleteAssessment(4, '17')).rejects.toMatchObject({ statusCode: 404 });
    expect(mockRepository.deleteAssessment).toHaveBeenCalledWith(17, 4);
  });
});
