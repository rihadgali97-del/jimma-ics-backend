import { jest } from '@jest/globals';

const mockCreate = jest.fn();
const mockFailureCreate = jest.fn();

jest.unstable_mockModule('../src/config/database.js', () => ({
  prisma: {
    auditLog: { create: mockCreate },
    auditWriteFailure: { create: mockFailureCreate },
  },
}));

const { writeAuditLog } = await import('../src/common/utils/auditLog.js');
const { auditRequestContext } = await import('../src/common/utils/auditRequestContext.js');

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({});
  mockFailureCreate.mockResolvedValue({});
});

describe('audit log client IP capture', () => {
  it('uses the current request IP when the service does not pass one explicitly', async () => {
    await new Promise((resolve, reject) => {
      auditRequestContext({ ip: '203.0.113.10' }, {}, () => {
        writeAuditLog({ actorId: 7, action: 'update', entityType: 'user', entityId: 12 })
          .then(resolve, reject);
      });
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ ipAddress: '203.0.113.10' }),
    });
  });

  it('keeps an explicitly supplied IP address', async () => {
    await new Promise((resolve, reject) => {
      auditRequestContext({ ip: '203.0.113.10' }, {}, () => {
        writeAuditLog({
          actorId: 7,
          action: 'update',
          entityType: 'user',
          ip: '198.51.100.5',
        }).then(resolve, reject);
      });
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ ipAddress: '198.51.100.5' }),
    });
  });

  it('leaves the IP empty when there is no request context', async () => {
    await writeAuditLog({ actorId: 7, action: 'update', entityType: 'user' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ ipAddress: null }),
    });
  });

  it('records and reports an audit-write failure without failing the primary operation', async () => {
    const err = Object.assign(new Error('database unavailable\nretry later'), { code: 'DB_OFFLINE' });
    mockCreate.mockRejectedValue(err);

    await new Promise((resolve, reject) => {
      auditRequestContext({ ip: '203.0.113.10', id: 'req-123' }, {}, () => {
        writeAuditLog({
          actorId: 7,
          action: 'update',
          entityType: 'user',
          entityId: 12,
        }).then(resolve, reject);
      });
    });

    expect(mockFailureCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 7,
        action: 'update',
        entityType: 'user',
        entityId: 12,
        errorCode: 'DB_OFFLINE',
        errorMessage: 'database unavailable retry later',
        requestId: 'req-123',
      }),
    });
  });

  it('does not fail the primary operation if the operational failure record cannot be persisted', async () => {
    mockCreate.mockRejectedValue(new Error('audit database failure'));
    mockFailureCreate.mockRejectedValue(new Error('failure recorder unavailable'));

    await expect(writeAuditLog({
      actorId: 7,
      action: 'update',
      entityType: 'user',
    })).resolves.toBeUndefined();
  });
});
