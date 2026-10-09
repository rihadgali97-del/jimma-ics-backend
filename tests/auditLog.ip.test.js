import { jest } from '@jest/globals';

const mockCreate = jest.fn();

jest.unstable_mockModule('../src/config/database.js', () => ({
  prisma: { auditLog: { create: mockCreate } },
}));

const { writeAuditLog } = await import('../src/common/utils/auditLog.js');
const { auditRequestContext } = await import('../src/common/utils/auditRequestContext.js');

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({});
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
});
