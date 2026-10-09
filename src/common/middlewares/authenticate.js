import { verifyAccessToken } from '../utils/jwt.js';
import { UnauthorizedError } from '../errors/httpErrors.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { prisma } from '../../config/database.js';
import { expandPermissionAliases } from '../utils/permissionAliases.js';

// Verifies the Bearer access token and attaches a minimal, trustworthy
// `req.user` ({ id, roleId, roleName, permissions }) to the request.
// Re-reads active status + permissions from DB rather than trusting stale
// token claims for anything security-sensitive (deactivated staff must be
// locked out immediately, not just after their token expires).
export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  const token = header.slice('Bearer '.length);

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError('Account is inactive or no longer exists');
  }

  req.user = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role.name,
    permissions: expandPermissionAliases([
      ...user.role.permissions.map((rp) => rp.permission.key),
      ...(Array.isArray(user.metadata?.customPermissions) ? user.metadata.customPermissions : []),
    ]),
  };

  next();
});