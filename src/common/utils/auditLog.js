import { prisma } from '../../config/database.js';
import { logger } from './logger.js';
import { getAuditRequestId, getAuditRequestIp } from './auditRequestContext.js';

export async function recordAuditWriteFailure({ err, actorId = null, action, entityType, entityId = null, requestId = getAuditRequestId() }) {
  const errorCode = typeof err?.code === 'string' ? err.code.slice(0, 100) : null;
  const errorMessage = (typeof err?.message === 'string' ? err.message : 'Unknown audit persistence error')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 500);

  logger.error({
    event: 'audit_write_failed',
    err,
    actorId,
    action,
    entityType,
    entityId,
    requestId,
  }, 'Audit record write failed');

  try {
    await prisma.auditWriteFailure.create({
      data: { actorId, action, entityType, entityId, requestId, errorCode, errorMessage },
    });
  } catch (failureRecordError) {
    logger.error({
      event: 'audit_write_failure_record_failed',
      err: failureRecordError,
      actorId,
      action,
      entityType,
      entityId,
      requestId,
    }, 'Could not persist audit write failure for operational review');
  }
}

/**
 * Writes one row to `audit_logs`. Called by services after any
 * administrative action that changes state (create/update/deactivate/login/
 * password reset/broadcast send/etc.) — never left to controllers to call
 * ad hoc, so coverage stays consistent across modules.
 *
 * Audit logging must never block or fail the primary operation, so errors
 * here are logged, not thrown.
 */
export async function writeAuditLog({
  actorId = null,
  action,
  entityType,
  entityId = null,
  before = null,
  after = null,
  ip = null,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        beforeJson: before ?? undefined,
        afterJson: after ?? undefined,
        ipAddress: ip ?? getAuditRequestIp(),
      },
    });
  } catch (err) {
    await recordAuditWriteFailure({ err, actorId, action, entityType, entityId });
  }
}