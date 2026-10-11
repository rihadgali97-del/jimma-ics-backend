import { jest } from '@jest/globals';

const mockRepository = {
  create: jest.fn(),
  findByReference: jest.fn(),
  findMany: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
};
const mockWriteAuditLog = jest.fn();

jest.unstable_mockModule('../src/modules/official-inquiries/official-inquiries.repository.js', () => ({
  officialInquiriesRepository: mockRepository,
}));
jest.unstable_mockModule('../src/common/utils/auditLog.js', () => ({
  writeAuditLog: mockWriteAuditLog,
}));

const officialInquiriesService = await import('../src/modules/official-inquiries/official-inquiries.service.js');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('official inquiries', () => {
  it('tracks an inquiry using its reference and normalized submitting phone', async () => {
    const createdAt = new Date('2026-10-10T12:00:00.000Z');
    const updatedAt = new Date('2026-10-10T13:00:00.000Z');
    mockRepository.findByReference.mockResolvedValue({
      referenceNumber: 'INQ-2026-A8237DF2E0874247',
      phone: '+251 91 234 5678',
      status: 'UNDER_REVIEW',
      createdAt,
      updatedAt,
      message: 'Do not include message contents in the tracking result.',
    });

    await expect(officialInquiriesService.trackOfficialInquiry(
      'inq-2026-a8237df2e0874247',
      '+251 (91) 234-5678'
    )).resolves.toEqual({
      referenceNumber: 'INQ-2026-A8237DF2E0874247',
      status: 'UNDER_REVIEW',
      createdAt,
      updatedAt,
    });
    expect(mockRepository.findByReference).toHaveBeenCalledWith('INQ-2026-A8237DF2E0874247');
  });

  it('does not disclose inquiry details when the phone does not match', async () => {
    mockRepository.findByReference.mockResolvedValue({
      referenceNumber: 'INQ-2026-A8237DF2E0874247',
      phone: '+251 91 234 5678',
    });

    await expect(officialInquiriesService.trackOfficialInquiry(
      'INQ-2026-A8237DF2E0874247',
      '+251 92 000 0000'
    )).rejects.toMatchObject({ statusCode: 404 });
  });

  it('creates a stored inquiry with a reference and audits the submission without message contents', async () => {
    mockRepository.create.mockImplementation(async (data) => ({
      id: 18,
      status: 'SUBMITTED',
      createdAt: new Date('2026-10-10T12:00:00.000Z'),
      ...data,
    }));

    const result = await officialInquiriesService.submitOfficialInquiry({
      fullName: 'Amina Ahmed',
      phone: '+251 91 234 5678',
      email: '',
      inquiryType: 'General',
      department: 'General Secretariat',
      message: 'Please advise me about a council service.',
    });

    expect(result).toMatchObject({
      referenceNumber: expect.stringMatching(/^INQ-\d{4}-[A-F0-9]{16}$/),
      status: 'SUBMITTED',
    });
    expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      email: null,
      fullName: 'Amina Ahmed',
      message: 'Please advise me about a council service.',
    }));
    expect(mockWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'official_inquiry',
      entityId: 18,
    }));
    expect(JSON.stringify(mockWriteAuditLog.mock.calls)).not.toContain('Please advise me');
  });

  it('lists inquiries with pagination and filters', async () => {
    const items = [{ id: 3 }, { id: 2 }];
    mockRepository.findMany.mockResolvedValue({ items, totalItems: 5 });

    await expect(officialInquiriesService.listOfficialInquiries({
      page: '2',
      pageSize: '2',
      status: 'SUBMITTED',
      search: 'Amina',
    })).resolves.toEqual({
      items,
      meta: { page: 2, pageSize: 2, totalItems: 5, totalPages: 3 },
    });
    expect(mockRepository.findMany).toHaveBeenCalledWith({
      skip: 2,
      take: 2,
      status: 'SUBMITTED',
      search: 'Amina',
    });
  });

  it('updates and audits the inquiry status', async () => {
    mockRepository.findById.mockResolvedValue({ id: 18, status: 'SUBMITTED' });
    const updated = { id: 18, status: 'UNDER_REVIEW' };
    mockRepository.update.mockResolvedValue(updated);

    await expect(officialInquiriesService.updateOfficialInquiryStatus(18, 'UNDER_REVIEW', 4))
      .resolves.toBe(updated);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 4,
      action: 'status_change',
      entityType: 'official_inquiry',
      entityId: 18,
      before: { status: 'SUBMITTED' },
      after: { status: 'UNDER_REVIEW' },
    }));
  });

  it('returns not found when staff update an unknown inquiry', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(officialInquiriesService.updateOfficialInquiryStatus(999, 'COMPLETED', 4))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(mockRepository.update).not.toHaveBeenCalled();
  });
});
