import { jest } from '@jest/globals';

const mockRepository = {
  listAvailability: jest.fn(),
  getAvailability: jest.fn(),
  setAvailability: jest.fn(),
};
const mockWriteAuditLog = jest.fn();

jest.unstable_mockModule('../src/modules/civic-services/civic-services.repository.js', () => ({
  civicServicesRepository: mockRepository,
}));
jest.unstable_mockModule('../src/common/utils/auditLog.js', () => ({
  writeAuditLog: mockWriteAuditLog,
}));

const civicServicesService = await import('../src/modules/civic-services/civic-services.service.js');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Civic service availability', () => {
  it('returns the availability list from the repository', async () => {
    const availability = [{ serviceKey: 'srv-2', isEnabled: false, updatedAt: null }];
    mockRepository.listAvailability.mockResolvedValue(availability);

    await expect(civicServicesService.listCivicServiceAvailability()).resolves.toBe(availability);
  });

  it('persists and audits a service availability change', async () => {
    mockRepository.getAvailability.mockResolvedValue({
      serviceKey: 'srv-4',
      isEnabled: true,
      updatedAt: null,
    });
    const updatedAt = new Date('2026-10-07T00:00:00.000Z');
    mockRepository.setAvailability.mockResolvedValue({
      serviceKey: 'srv-4',
      isEnabled: false,
      updatedAt,
    });

    await expect(civicServicesService.setCivicServiceAvailability('srv-4', false, 12)).resolves.toEqual({
      serviceKey: 'srv-4',
      isEnabled: false,
      updatedAt,
    });
    expect(mockRepository.setAvailability).toHaveBeenCalledWith('srv-4', false, 12);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 12,
      entityType: 'civic_service_setting',
      before: { serviceKey: 'srv-4', isEnabled: true },
      after: { serviceKey: 'srv-4', isEnabled: false },
    }));
  });

  it('rejects service keys that are not part of the public catalogue', async () => {
    await expect(
      civicServicesService.setCivicServiceAvailability('janazah', false, 12)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockRepository.setAvailability).not.toHaveBeenCalled();
  });
});
