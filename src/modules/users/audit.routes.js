import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { validate } from '../../common/middlewares/validate.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { buildPaginationMeta, parsePagination } from '../../common/utils/pagination.js';
import { sendCreated, sendSuccess } from '../../common/utils/apiResponse.js';
import { z } from '../../common/validation/shared.js';
import { prisma } from '../../config/database.js';
import { randomUUID, createHash } from 'node:crypto';
import { NotFoundError } from '../../common/errors/httpErrors.js';

export const auditRouter = Router();
auditRouter.use(authenticate);

const AUDIT_PERMISSIONS = ['users.manage'];
const directiveSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3).max(180),
    category: z.enum(['Shariah_Compliance', 'Financial_Integrity', 'CSO_Regulatory', 'Waqf_Endowment', 'IT_Security', 'Procurement_VAT']),
    severity: z.enum(['Low', 'Medium', 'High', 'Critical']),
    status: z.enum(['Open', 'Under Investigation', 'Resolved', 'Escalated to Shura']).default('Open'),
    targetEntity: z.string().trim().min(2).max(180),
    department: z.string().trim().min(2).max(120),
    findings: z.string().trim().min(3).max(5000),
    requiredAction: z.string().trim().max(5000).default(''),
    assignedAuditor: z.string().trim().min(2).max(150),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amountETB: z.coerce.number().positive().optional(),
    voucherId: z.string().trim().max(80).optional(),
  }),
});
const directiveUpdateSchema = z.object({
  params: z.object({ id: z.string().trim().min(1).max(60) }),
  body: z.object({
    status: z.enum(['Open', 'Under Investigation', 'Resolved', 'Escalated to Shura']),
    resolutionNote: z.string().trim().max(5000).optional(),
  }),
});
const directiveIdSchema = z.object({ params: z.object({ id: z.string().trim().min(1).max(60) }) });
const checklistUpdateSchema = z.object({
  params: z.object({ id: z.string().trim().min(1).max(80) }),
  body: z.object({
    status: z.enum(['Compliant', 'Pending Review', 'Action Required', 'Exempt']),
    evidenceNote: z.string().trim().max(5000).optional(),
    verifiedBy: z.string().trim().min(2).max(150),
  }),
});

function toDirectiveEvent(record) {
  const value = record.afterJson;
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function currentDirectives(events) {
  const latest = new Map();
  for (const event of events) {
    const directive = toDirectiveEvent(event);
    if (!directive?.id || latest.has(directive.id)) continue;
    latest.set(directive.id, event.action === 'archive' ? null : directive);
  }
  return [...latest.values()].filter(Boolean);
}

async function writeAuditEvent(req, { action, entityType, entityId = null, before = null, after = null }) {
  return prisma.auditLog.create({
    data: {
      actorId: req.user.id,
      action,
      entityType,
      entityId,
      beforeJson: before ?? undefined,
      afterJson: after ?? undefined,
      ipAddress: req.ip,
    },
  });
}

function mapAuditLog(item) {
  return {
    id: item.id,
    actor: item.actor
      ? { fullName: item.actor.fullName, email: item.actor.email, role: { name: item.actor.role.name } }
      : null,
    action: item.action,
    entityType: item.entityType,
    entityId: item.entityId,
    before: item.beforeJson,
    after: item.afterJson,
    ipAddress: item.ipAddress,
    createdAt: item.createdAt,
  };
}

auditRouter.get('/', authorize('users.manage'), validate(z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
  }),
})), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const where = { entityType: { in: ['user', 'role', 'auth', 'session'] } };
  const [items, totalItems] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { actor: { include: { role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  sendSuccess(res, {
    data: items.map(mapAuditLog),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  });
}));

auditRouter.get('/compliance', authorize(...AUDIT_PERMISSIONS), validate(z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
  }),
})), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const [items, totalItems] = await Promise.all([
    prisma.auditLog.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { actor: { include: { role: true } } },
    }),
    prisma.auditLog.count(),
  ]);
  sendSuccess(res, {
    data: items.map(mapAuditLog),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  });
}));

auditRouter.get('/directives', authorize(...AUDIT_PERMISSIONS), asyncHandler(async (_req, res) => {
  const events = await prisma.auditLog.findMany({
    where: { entityType: 'audit_directive' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 500,
  });
  sendSuccess(res, { data: currentDirectives(events) });
}));

auditRouter.post('/directives', authorize(...AUDIT_PERMISSIONS), validate(directiveSchema), asyncHandler(async (req, res) => {
  const directive = {
    ...req.body,
    id: `AUD-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
    createdDate: new Date().toISOString().slice(0, 10),
  };
  await writeAuditEvent(req, { action: 'create', entityType: 'audit_directive', after: directive });
  sendCreated(res, directive);
}));

auditRouter.patch('/directives/:id', authorize(...AUDIT_PERMISSIONS), validate(directiveUpdateSchema), asyncHandler(async (req, res) => {
  const events = await prisma.auditLog.findMany({
    where: { entityType: 'audit_directive' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 500,
  });
  const existing = currentDirectives(events).find((directive) => directive.id === req.params.id);
  if (!existing) throw new NotFoundError('Audit directive not found');

  const updated = {
    ...existing,
    status: req.body.status,
    ...(req.body.status === 'Resolved'
      ? { resolvedDate: new Date().toISOString().slice(0, 10), resolutionNote: req.body.resolutionNote || '' }
      : {}),
  };
  await writeAuditEvent(req, {
    action: req.body.status === 'Resolved' ? 'resolve' : req.body.status === 'Escalated to Shura' ? 'escalate' : 'update',
    entityType: 'audit_directive',
    before: existing,
    after: updated,
  });
  sendSuccess(res, { data: updated });
}));

auditRouter.delete('/directives/:id', authorize(...AUDIT_PERMISSIONS), validate(directiveIdSchema), asyncHandler(async (req, res) => {
  const events = await prisma.auditLog.findMany({
    where: { entityType: 'audit_directive' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 500,
  });
  const existing = currentDirectives(events).find((directive) => directive.id === req.params.id);
  if (!existing) throw new NotFoundError('Audit directive not found');

  await writeAuditEvent(req, { action: 'archive', entityType: 'audit_directive', before: existing, after: { id: existing.id } });
  sendSuccess(res, { data: { id: existing.id } });
}));

auditRouter.get('/checklist', authorize(...AUDIT_PERMISSIONS), asyncHandler(async (_req, res) => {
  const events = await prisma.auditLog.findMany({
    where: { entityType: 'compliance_checklist' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1000,
  });
  const latestByItem = new Map();
  for (const event of events) {
    const item = toDirectiveEvent(event);
    if (item?.itemId && !latestByItem.has(item.itemId)) latestByItem.set(item.itemId, item);
  }
  sendSuccess(res, { data: [...latestByItem.values()] });
}));

auditRouter.patch('/checklist/:id', authorize(...AUDIT_PERMISSIONS), validate(checklistUpdateSchema), asyncHandler(async (req, res) => {
  const item = {
    itemId: req.params.id,
    status: req.body.status,
    evidenceNote: req.body.evidenceNote || '',
    verifiedBy: req.body.verifiedBy,
    lastVerified: new Date().toISOString().slice(0, 10),
  };
  await writeAuditEvent(req, { action: 'update', entityType: 'compliance_checklist', after: item });
  sendSuccess(res, { data: item });
}));

auditRouter.post('/integrity-scan', authorize(...AUDIT_PERMISSIONS), asyncHandler(async (req, res) => {
  const [donations, distributions] = await Promise.all([
    prisma.donationIntent.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, reference: true, amountETB: true, status: true, createdAt: true },
    }),
    prisma.zakatDistribution.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, totalDisbursedETB: true, beneficiaryCount: true, lastDisbursalDate: true },
    }),
  ]);
  const snapshot = {
    donationIntents: donations.map((item) => ({
      ...item,
      amountETB: item.amountETB.toString(),
      createdAt: item.createdAt.toISOString(),
    })),
    zakatDistributions: distributions.map((item) => ({
      ...item,
      totalDisbursedETB: item.totalDisbursedETB.toString(),
      lastDisbursalDate: item.lastDisbursalDate.toISOString(),
    })),
  };
  const digest = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  const result = {
    scannedTables: ['donation_intents', 'zakat_distributions'],
    checkedRecords: donations.length + distributions.length,
    donationIntentCount: donations.length,
    zakatDistributionCount: distributions.length,
    digest,
    scannedAt: new Date().toISOString(),
  };
  await writeAuditEvent(req, { action: 'integrity_snapshot', entityType: 'audit_integrity_scan', after: result });
  sendSuccess(res, { data: result });
}));
