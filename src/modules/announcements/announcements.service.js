import { announcementsRepository } from './announcements.repository.js';
import { NotFoundError } from '../../common/errors/httpErrors.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';
import { documentsRepository } from '../documents/documents.repository.js';
import { logger } from '../../common/utils/logger.js';
import {
  cancelQueuedAnnouncementNotifications,
  queueAnnouncementNotifications,
} from '../notifications/notifications.service.js';

const ENTITY_TYPE = 'announcement';

function toPublic(announcement) {
  return {
    ...announcement,
    id: String(announcement.id),
    publishDate: announcement.publishDate.toISOString().slice(0, 10),
    date: announcement.publishDate.toISOString().slice(0, 10),
    isUrgent: announcement.isUrgent || announcement.priority === 'High',
  };
}

function toDateData(data) {
  if (!data.publishDate) return data;
  const { publishDate, ...fields } = data;
  return { ...fields, publishDate: new Date(`${publishDate}T00:00:00.000Z`) };
}

export async function listAnnouncements(query, { publicOnly = true } = {}) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const { items, totalItems } = await announcementsRepository.findMany({
    skip, take, search: query.search, category: query.category, priority: query.priority, publicOnly,
  });
  const images = await Promise.all(items.map((item) => documentsRepository.findByEntity(ENTITY_TYPE, item.id)));
  return { items: items.map((item, index) => ({ ...toPublic(item), imageUrl: images[index].filter((d) => d.mimeType?.startsWith('image/')).at(-1)?.url || null })), meta: buildPaginationMeta({ page, pageSize, totalItems }) };
}

export async function getAnnouncement(id, { publicOnly = true } = {}) {
  const announcement = await announcementsRepository.findById(id);
  if (!announcement || (publicOnly && !announcement.isPublished)) throw new NotFoundError('Announcement not found');
  const images = await documentsRepository.findByEntity(ENTITY_TYPE, announcement.id);
  return { ...toPublic(announcement), imageUrl: images.filter((d) => d.mimeType?.startsWith('image/')).at(-1)?.url || null };
}

export async function createAnnouncement(data, actorId) {
  const announcement = await announcementsRepository.create(toDateData(data));
  await writeAuditLog({
    actorId, action: 'create', entityType: ENTITY_TYPE, entityId: announcement.id,
    after: { title: announcement.title, isPublished: announcement.isPublished },
  });
  await queueAnnouncementSideEffect(announcement);
  return toPublic(announcement);
}

export async function updateAnnouncement(id, data, actorId) {
  const existing = await announcementsRepository.findById(id);
  if (!existing) throw new NotFoundError('Announcement not found');
  const announcement = await announcementsRepository.update(id, toDateData(data));
  await writeAuditLog({ actorId, action: 'update', entityType: ENTITY_TYPE, entityId: id, after: data });
  const notificationRelevantFields = ['title', 'category', 'publishDate', 'summary', 'content', 'district', 'isUrgent', 'priority', 'isPublished'];
  if (notificationRelevantFields.some((field) => data[field] !== undefined && data[field] !== existing[field])) {
    await queueAnnouncementSideEffect(announcement, async () => {
      await cancelQueuedAnnouncementNotifications(id);
      if (announcement.isPublished) await queueAnnouncementNotifications(announcement);
    });
  }
  return toPublic(announcement);
}

async function queueAnnouncementSideEffect(announcement, operation = () => queueAnnouncementNotifications(announcement)) {
  try {
    await operation();
  } catch (err) {
    logger.error(
      { err, announcementId: announcement.id },
      'Queueing announcement notifications failed after the announcement was saved'
    );
  }
}

export async function deleteAnnouncement(id, actorId) {
  const existing = await announcementsRepository.findById(id);
  if (!existing) throw new NotFoundError('Announcement not found');
  await announcementsRepository.delete(id);
  await queueAnnouncementSideEffect(existing, () => cancelQueuedAnnouncementNotifications(id));
  await writeAuditLog({ actorId, action: 'delete', entityType: ENTITY_TYPE, entityId: id, after: { title: existing.title } });
}
