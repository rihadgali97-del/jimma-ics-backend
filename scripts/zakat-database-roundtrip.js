import { randomUUID } from 'node:crypto';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/database.js';
import * as zakatService from '../src/modules/zakat/zakat.service.js';

const databaseUrl = new URL(env.DATABASE_URL);
const databaseName = databaseUrl.pathname.replace(/^\//, '');

if (
  env.NODE_ENV !== 'development'
  || !['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)
  || databaseName !== 'jimma_ics'
) {
  console.error('Refusing the Zakat round-trip: expected the local development jimma_ics database.');
  process.exit(1);
}

let userId;
let assessmentId;
let applicationId;
let applicationReference;

try {
  await prisma.$connect();
  const user = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!user) throw new Error('No active user is available for an account assessment round-trip.');
  userId = user.id;

  const woreda = await prisma.woreda.findFirst({ select: { id: true } });
  if (!woreda) throw new Error('No woreda is available for an application round-trip.');

  const applicantMarker = `AUTO-ZAKAT-DB-${randomUUID()}`;
  const applicantPhone = '+251000000000';
  const application = await zakatService.submitZakatApplication({
    woredaId: woreda.id,
    applicantFullName: applicantMarker,
    applicantPhone,
    householdSize: 1,
  });
  applicationId = application.id;
  applicationReference = application.referenceNumber;

  const reviewed = await zakatService.updateZakatStatus(
    applicationId,
    { status: 'UNDER_REVIEW', eligibilityNotes: applicantMarker },
    userId
  );
  if (reviewed.status !== 'UNDER_REVIEW') throw new Error('Application status update was not persisted.');

  const assigned = await zakatService.assignZakatOfficer(applicationId, userId, userId);
  if (assigned.assignedOfficer?.id !== userId) throw new Error('Officer assignment was not persisted.');

  const applicationList = await zakatService.listZakatApplications({
    page: 1,
    pageSize: 100,
    search: applicantMarker,
    status: 'UNDER_REVIEW',
  });
  if (!applicationList.items.some((item) => item.id === applicationId)) {
    throw new Error('Updated application was not returned by the filtered case list.');
  }

  const tracked = await zakatService.trackZakatApplication(applicationReference, applicantPhone);
  if (tracked.status !== 'UNDER_REVIEW' || tracked.applicantFullName !== applicantMarker) {
    throw new Error('Updated application could not be tracked.');
  }
  if ('eligibilityNotes' in tracked || 'assignedOfficer' in tracked) {
    throw new Error('Application tracking included internal case information.');
  }
  await zakatService.trackZakatApplication(applicationReference, '+251000000001')
    .then(() => { throw new Error('Application tracking accepted a mismatched phone.'); })
    .catch((error) => {
      if (error.message === 'Application tracking accepted a mismatched phone.') throw error;
      if (error.statusCode !== 404) throw error;
    });

  const marker = `AUTO-ZAKAT-DB-${randomUUID()}`;
  const summary = {
    marker,
    netZakatableWealthETB: 123456,
    totalZakatObligationETB: 3086,
  };

  const saved = await zakatService.saveAssessment(userId, { title: marker, summary });
  assessmentId = Number(saved.id);
  if (saved.marker !== marker || saved.netZakatableWealthETB !== summary.netZakatableWealthETB) {
    throw new Error('Saved assessment did not return the submitted summary.');
  }

  const listed = await zakatService.listAssessments(userId);
  if (!listed.some((item) => item.id === saved.id && item.marker === marker)) {
    throw new Error('Saved assessment was not returned by the account assessment list.');
  }

  await zakatService.deleteAssessment(userId, saved.id);
  assessmentId = undefined;
  const afterDelete = await zakatService.listAssessments(userId);
  if (afterDelete.some((item) => item.marker === marker)) {
    throw new Error('Deleted assessment is still present in the account assessment list.');
  }

  console.log('Zakat database round-trip passed: submit, review, assignment, tracking, phone check, and assessment save/list/delete verified.');
} catch (error) {
  console.error(`Zakat assessment database round-trip failed (${error.code || error.name || 'Error'}).`);
  process.exitCode = 1;
} finally {
  if (applicationId) {
    await prisma.auditLog.deleteMany({ where: { entityType: 'zakat_application', entityId: applicationId } }).catch(() => {});
    await prisma.zakatApplication.deleteMany({ where: { id: applicationId } }).catch(() => {});
  }
  if (assessmentId && userId) {
    await prisma.zakatAssessment.deleteMany({ where: { id: assessmentId, userId } }).catch(() => {});
  }
  await prisma.$disconnect();
}
