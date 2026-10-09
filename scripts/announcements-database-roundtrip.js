import { prisma, disconnectDatabase } from '../src/config/database.js';
import { listAnnouncements, getAnnouncement } from '../src/modules/announcements/announcements.service.js';
import request from 'supertest';
import { createApp } from '../src/app.js';

const databaseUrl = new URL(process.env.DATABASE_URL);
const databaseName = databaseUrl.pathname.replace(/^\//, '');
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1'].includes(databaseUrl.hostname) || databaseName !== 'jimma_ics') {
  throw new Error('Refusing announcement round-trip: expected the local jimma_ics development database.');
}

const marker = `__ANNOUNCEMENT_DB_CHECK_${Date.now()}__`;
let created;

try {
  created = await prisma.announcement.create({
    data: {
      title: marker,
      category: 'Official Communique',
      publishDate: new Date('2026-10-03T00:00:00.000Z'),
      hijriDate: '',
      author: 'Automated database check',
      summary: 'Temporary database round-trip record.',
      content: 'This record is removed after the round-trip check.',
      isPublished: true,
    },
  });

  const list = await listAnnouncements({ search: marker, page: 1, pageSize: 10 });
  if (list.items.length !== 1 || list.items[0].id !== String(created.id)) {
    throw new Error('Created announcement was not returned by the public service listing.');
  }

  const detail = await getAnnouncement(created.id);
  if (detail.title !== marker || detail.date !== '2026-10-03') {
    throw new Error('Announcement detail mapping did not match the saved record.');
  }

  await prisma.announcement.update({ where: { id: created.id }, data: { isPinned: true } });
  const updated = await getAnnouncement(created.id);
  if (!updated.isPinned) throw new Error('Announcement update was not persisted.');

  const app = createApp();
  const publicResponse = await request(app).get(`/api/v1/announcements?search=${encodeURIComponent(marker)}`);
  if (publicResponse.status !== 200 || publicResponse.body.data?.[0]?.id !== String(created.id)) {
    throw new Error('Public announcement HTTP endpoint did not return the saved record.');
  }
  const adminResponse = await request(app).get('/api/v1/admin/announcements');
  if (adminResponse.status !== 401) throw new Error('Admin announcements endpoint did not require authentication.');

  console.log('Announcement database/API round-trip passed (create, public list/detail, update, admin auth).');
} finally {
  if (created) await prisma.announcement.deleteMany({ where: { id: created.id } });
  await disconnectDatabase();
}
