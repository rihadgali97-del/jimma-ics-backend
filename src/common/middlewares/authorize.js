import { ForbiddenError } from '../errors/httpErrors.js';

// Permission-based authorization: authorize('mosques.write') requires the
// authenticated user's role to carry that permission key. Always mount
// `authenticate` before this on the route. `super_admin` implicitly passes
// every check.
export function authorize(...requiredPermissions) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.user) {
      return next(new ForbiddenError('Authentication is required before authorization'));
    }

    if (req.user.roleName === 'super_admin') {
      return next();
    }

    const grantedPermissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    const hasAll = requiredPermissions.every((perm) => grantedPermissions.includes(perm));

    if (!hasAll) {
      return next(
        new ForbiddenError(
          `Requires permission(s): ${requiredPermissions.join(', ')}`
        )
      );
    }

    return next();
  };
}

// Convenience helper for the (rarer) case of gating by role name directly
// rather than by granular permission.
export function requireRole(...roleNames) {
  return function requireRoleMiddleware(req, res, next) {
    if (!req.user) {
      return next(new ForbiddenError('Authentication is required before authorization'));
    }
    if (req.user.roleName === 'super_admin' || roleNames.includes(req.user.roleName)) {
      return next();
    }
    return next(new ForbiddenError(`Requires role: ${roleNames.join(' or ')}`));
  };
}

export function authorizeAny(...permissions) {
  return function authorizeAnyMiddleware(req, res, next) {
    if (!req.user) return next(new ForbiddenError('Authentication is required before authorization'));
    const grantedPermissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    if (req.user.roleName === 'super_admin' || permissions.some((permission) => grantedPermissions.includes(permission))) {
      return next();
    }
    return next(new ForbiddenError(`Requires one of these permissions: ${permissions.join(', ')}`));
  };
}
