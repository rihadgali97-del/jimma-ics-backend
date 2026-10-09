import { AsyncLocalStorage } from 'node:async_hooks';

const requestIpContext = new AsyncLocalStorage();

export function auditRequestContext(req, _res, next) {
  requestIpContext.run(req.ip || null, next);
}

export function getAuditRequestIp() {
  return requestIpContext.getStore() || null;
}
