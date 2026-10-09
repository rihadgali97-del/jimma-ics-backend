import { jest } from '@jest/globals';

const mockRepository = {
  findMany: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const mockWriteAuditLog = jest.fn();
const mockQueueAnnouncementNotifications = jest.fn();
const mockFindDocumentsByEntity = jest.fn();

jest.unstable_mockModule('../src/modules/announcements/announcements.repository.js', () => ({
  announcementsRepository: mockRepository,
}));
jest.unstable_mockModule('../src/common/utils/auditLog.js', () => ({ writeAuditLog: mockWriteAuditLog }));
jest.unstable_mockModule('../src/modules/notifications/notifications.service.js', () => ({
  cancelQueuedAnnouncementNotifications: jest.fn(),
  queueAnnouncementNotifications: mockQueueAnnouncementNotifications,
}));
jest.unstable_mockModule('../src/modules/documents/documents.repository.js', () => ({
  documentsRepository: { findByEntity: mockFindDocumentsByEntity },
}));

const service = await import('../src/modules/announcements/announcements.service.js');
const { createAnnouncementSchema, updateAnnouncementSchema } = await import('../src/modules/announcements/announcements.validation.js');

const announcement = {
  id: 9,
  title: 'Council Communique',
  category: 'Official Communique',
  publishDate: new Date('2026-10-03T00:00:00.000Z'),
  hijriDate: '20 Rabi al-Thani 1448',
  author: 'Council Secretariat',
  summary: 'A public notice.',
  content: 'Full announcement body.',
  isPinned: true,
  isUrgent: true,
  priority: 'High',
  district: 'Jimma Zone',
  targetAudience: 'Community',
  readTime: '1 min read',
  isPublished: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFindDocumentsByEntity.mockResolvedValue([]);
});

describe('Announcements service', () => {
  it('returns date aliases used by the public UI and normalizes IDs', async () => {
    mockRepository.findMany.mockResolvedValue({ items: [announcement], totalItems: 1 });

    const result = await service.listAnnouncements({ page: '1', pageSize: '10' });
    expect(result.items[0]).toMatchObject({ id: '9', publishDate: '2026-10-03', date: '2026-10-03', isUrgent: true });
    expect(result.meta.totalItems).toBe(1);
  });

  it('hides unpublished announcements from public detail requests', async () => {
    mockRepository.findById.mockResolvedValue({ ...announcement, isPublished: false });

    await expect(service.getAnnouncement(9)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('creates an announcement with a parsed publish date and audit entry', async () => {
    mockRepository.create.mockResolvedValue(announcement);
    const result = await service.createAnnouncement({
      title: announcement.title,
      category: announcement.category,
      publishDate: '2026-10-03',
      author: announcement.author,
      summary: announcement.summary,
      content: announcement.content,
    }, 4);

    expect(result.id).toBe('9');
    expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({ publishDate: new Date('2026-10-03T00:00:00.000Z') }));
    expect(mockWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({ actorId: 4, action: 'create', entityType: 'announcement' }));
  });

  it('rejects an update for an unknown announcement', async () => {
    mockRepository.findById.mockResolvedValue(null);
    await expect(service.updateAnnouncement(999, { title: 'Changed title' }, 4)).rejects.toMatchObject({ statusCode: 404 });
    expect(mockRepository.update).not.toHaveBeenCalled();
  });
});

describe('Announcement request validation', () => {
  const validBody = {
    title: 'Council Communique', category: 'Official Communique', publishDate: '2026-10-03',
    author: 'Council Secretariat', summary: 'A public notice.', content: 'Full announcement body.',
  };

  it('rejects impossible publication dates', () => {
    expect(createAnnouncementSchema.safeParse({ body: { ...validBody, publishDate: '2026-02-30' } }).success).toBe(false);
  });

  it('rejects empty patches', () => {
    expect(updateAnnouncementSchema.safeParse({ params: { id: '9' }, body: {} }).success).toBe(false);
  });
});
