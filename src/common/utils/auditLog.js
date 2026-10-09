import { prisma } from '../../config/database.js';
import { logger } from './logger.js';
import { getAuditRequestIp } from './auditRequestContext.js';

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
    logger.error({ err, action, entityType, entityId }, 'Failed to write audit log');
  }
}