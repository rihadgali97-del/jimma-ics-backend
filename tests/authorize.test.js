import { authorize, authorizeAny, requireRole } from '../src/common/middlewares/authorize.js';

function runMiddleware(middleware, user) {
  return new Promise((resolve) => {
    middleware({ user }, {}, (error) => resolve(error || null));
  });
}

describe('role permission authorization', () => {
  it('allows a user when their assigned role grants every required permission', async () => {
    const result = await runMiddleware(authorize('finance.write', 'dashboard.view'), {
      roleName: 'finance_officer',
      permissions: ['finance.write', 'dashboard.view'],
    });

    expect(result).toBeNull();
  });

  it('denies a user when their assigned role is missing any required permission', async () => {
    const result = await runMiddleware(authorize('finance.write', 'users.manage'), {
      roleName: 'finance_officer',
      permissions: ['finance.write'],
    });

    expect(result).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('does not allow a different role name to substitute for a missing permission', async () => {
    const result = await runMiddleware(authorize('users.manage'), {
      roleName: 'secretariat_admin',
      permissions: ['events.write'],
    });

    expect(result).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('allows a user with any one of the explicitly accepted permissions', async () => {
    const result = await runMiddleware(authorizeAny('janazah.manage', 'zakat.manage'), {
      roleName: 'case_officer',
      permissions: ['zakat.manage'],
    });

    expect(result).toBeNull();
  });

  it('reserves role-only routes for the named role', async () => {
    const result = await runMiddleware(requireRole('super_admin'), {
      roleName: 'finance_officer',
      permissions: ['finance.write', 'system.settings.read'],
    });

    expect(result).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('continues to allow the super admin system override', async () => {
    const result = await runMiddleware(authorize('users.manage'), {
      roleName: 'super_admin',
      permissions: [],
    });

    expect(result).toBeNull();
  });

  it('denies malformed permission data rather than failing with a server error', async () => {
    const result = await runMiddleware(authorize('users.manage'), {
      roleName: 'finance_officer',
      permissions: null,
    });

    expect(result).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });
});
