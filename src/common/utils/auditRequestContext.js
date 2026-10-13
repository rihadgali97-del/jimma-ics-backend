import { AsyncLocalStorage } from 'node:async_hooks';

const requestIpContext = new AsyncLocalStorage();

export function auditRequestContext(req, _res, next) {
  requestIpContext.run({
    ip: req.ip || null,
    requestId: typeof req.id === 'string' ? req.id.slice(0, 191) : null,
  }, next);
}

export function getAuditRequestIp() {
  return requestIpContext.getStore()?.ip || null;
}

export function getAuditRequestId() {
  return requestIpContext.getStore()?.requestId || null;
}
