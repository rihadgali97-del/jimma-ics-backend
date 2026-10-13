import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
};

const mockVerifyAccessToken = jest.fn();

jest.unstable_mockModule('../src/config/database.js', () => ({
  prisma: mockPrisma,
}));

jest.unstable_mockModule('../src/common/utils/jwt.js', () => ({
  verifyAccessToken: mockVerifyAccessToken,
}));

const { authenticate } = await import('../src/common/middlewares/authenticate.js');
const { authorize } = await import('../src/common/middlewares/authorize.js');

function invoke(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (error) => resolve(error || null));
  });
}

function makeRequest() {
  return { headers: { authorization: 'Bearer test-access-token' } };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyAccessToken.mockReturnValue({ sub: 42 });
});

describe('staff authentication and custom-role authorization', () => {
  it('uses the assigned custom role permissions and denies permissions it does not grant', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 42,
      fullName: 'Custom Role Staff',
      email: 'staff@example.com',
      roleId: 8,
      isActive: true,
      role: {
        name: 'event_reviewers',
        permissions: [{ permission: { key: 'events.write' } }],
      },
      metadata: null,
    });
    const req = makeRequest();

    expect(await invoke(authenticate, req)).toBeNull();
    expect(req.user).toMatchObject({
      id: 42,
      roleName: 'event_reviewers',
      permissions: ['events.write'],
    });
    expect(await invoke(authorize('events.write'), req)).toBeNull();
    expect(await invoke(authorize('finance.write'), req)).toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('applies per-user custom permissions and reads changed role grants on the next request', async () => {
    const user = {
      id: 42,
      fullName: 'Custom Role Staff',
      email: 'staff@example.com',
      roleId: 8,
      isActive: true,
      role: {
        name: 'event_reviewers',
        permissions: [{ permission: { key: 'events.write' } }],
      },
      metadata: { customPermissions: ['finance.write'] },
    };
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({
        ...user,
        role: { ...user.role, permissions: [{ permission: { key: 'finance.write' } }] },
      });

    const firstRequest = makeRequest();
    expect(await invoke(authenticate, firstRequest)).toBeNull();
    expect(await invoke(authorize('finance.write'), firstRequest)).toBeNull();

    const secondRequest = makeRequest();
    expect(await invoke(authenticate, secondRequest)).toBeNull();
    expect(await invoke(authorize('events.write'), secondRequest)).toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
    expect(await invoke(authorize('finance.write'), secondRequest)).toBeNull();
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it('rejects inactive staff before authorization', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 42,
      isActive: false,
      role: { name: 'event_reviewers', permissions: [] },
      metadata: null,
    });

    const req = makeRequest();
    expect(await invoke(authenticate, req)).toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
    expect(req.user).toBeUndefined();
  });

  it('rejects an existing access token while the user must reset their password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 42,
      isActive: true,
      role: { name: 'event_reviewers', permissions: [] },
      metadata: { forcePasswordReset: true },
    });

    const req = makeRequest();
    expect(await invoke(authenticate, req)).toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
    expect(req.user).toBeUndefined();
  });
});
