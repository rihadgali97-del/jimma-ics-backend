import { randomUUID } from 'crypto';
import { authRepository } from './auth.repository.js';
import { verifyPassword, hashPassword } from '../../common/utils/password.js';
import { sha256Hex, randomToken } from '../../common/utils/hash.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../common/utils/jwt.js';
import { UnauthorizedError, NotFoundError, ConflictError, BadRequestError } from '../../common/errors/httpErrors.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { logger } from '../../common/utils/logger.js';
import { env } from '../../config/env.js';
import { expandPermissionAliases } from '../../common/utils/permissionAliases.js';

const REFRESH_TOKEN_TTL_MS = env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

function toPublicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role.name,
    roleId: user.roleId,
    permissions: expandPermissionAliases([
      ...(user.role.permissions?.map((rp) => rp.permission.key) ?? []),
      ...(Array.isArray(user.metadata?.customPermissions) ? user.metadata.customPermissions : []),
    ]),
    lastLoginAt: user.lastLoginAt,
  };
}

async function issueTokenPair(user, ip) {
  const jti = randomUUID();
  const accessToken = signAccessToken({ sub: user.id, roleId: user.roleId });
  const refreshToken = signRefreshToken({ sub: user.id, jti });

  await authRepository.createRefreshToken({
    userId: user.id,
    tokenHash: sha256Hex(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    createdByIp: ip,
  });

  return { accessToken, refreshToken };
}

export async function login({ email, password, ip }) {
  const user = await authRepository.findActiveUserByEmail(email);

  // Same error/message whether the email doesn't exist or the password is
  // wrong — never let this endpoint reveal which accounts exist.
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const passwordMatches = await verifyPassword(user.passwordHash, password);
  if (!passwordMatches) {
    throw new UnauthorizedError('Invalid email or password');
  }

  await authRepository.touchLastLogin(user.id);
  const tokens = await issueTokenPair(user, ip);

  await writeAuditLog({
    actorId: user.id,
    action: 'login',
    entityType: 'user',
    entityId: user.id,
    ip,
  });

  return { ...tokens, user: toPublicUser(user) };
}

export async function refresh({ refreshToken, ip }) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const tokenHash = sha256Hex(refreshToken);
  const stored = await authRepository.findRefreshTokenByHash(tokenHash);

  const isValidStoredToken =
    stored && !stored.revokedAt && stored.expiresAt > new Date() && stored.userId === payload.sub;

  if (!isValidStoredToken) {
    throw new UnauthorizedError('Refresh token is no longer valid');
  }

  const user = await authRepository.findUserById(stored.userId);
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Account is inactive or no longer exists');
  }

  // Rotation: the presented token is immediately revoked and a brand new
  // pair is issued. If a revoked token is ever replayed, that's a strong
  // signal of token theft — worth alerting on in a later phase.
  await authRepository.revokeRefreshTokenById(stored.id);
  const tokens = await issueTokenPair(user, ip);

  return { ...tokens, user: toPublicUser(user) };
}

export async function logout({ refreshToken }) {
  if (!refreshToken) return;
  await authRepository.revokeRefreshTokenByHash(sha256Hex(refreshToken));
}

export async function me(userId) {
  const user = await authRepository.findUserById(userId);
  if (!user) throw new NotFoundError('User not found');
  return toPublicUser(user);
}

export async function forgotPassword({ email }) {
  const user = await authRepository.findActiveUserByEmail(email);

  // Deliberately do not throw NotFoundError here — the controller always
  // returns the same generic message so this endpoint can't be used to
  // enumerate valid staff email addresses.
  if (!user || !user.isActive) return;

  const rawToken = randomToken(32);
  await authRepository.createPasswordResetToken({
    userId: user.id,
    tokenHash: sha256Hex(rawToken),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  });

  // TODO(Phase 6 - Notifications module): dispatch this via email instead of
  // logging it. Until then, an operator can read it from server logs to
  // manually relay a reset link during Phase 1-5 development/staging.
  logger.info(
    { userId: user.id, rawToken },
    'Password reset token issued — email dispatch pending Phase 6'
  );
}

export async function resetPassword({ token, newPassword }) {
  const tokenHash = sha256Hex(token);
  const stored = await authRepository.findPasswordResetTokenByHash(tokenHash);

  const isValid = stored && !stored.usedAt && stored.expiresAt > new Date();
  if (!isValid) {
    throw new UnauthorizedError('Password reset token is invalid or has expired');
  }

  const passwordHash = await hashPassword(newPassword);

  await authRepository.updateUserPassword(stored.userId, passwordHash);
  await authRepository.markPasswordResetTokenUsed(stored.id);
  // Force re-login on every device after a password reset.
  await authRepository.revokeAllRefreshTokensForUser(stored.userId);

  await writeAuditLog({
    actorId: stored.userId,
    action: 'password_reset',
    entityType: 'user',
    entityId: stored.userId,
  });
}

export async function register({ fullName, email, phone, password }) {
  const existing = await authRepository.findActiveUserByEmail(email);
  if (existing) throw new ConflictError('An account with this email already exists');

  const pendingRole = await authRepository.findRoleByName('pending_staff');
  if (!pendingRole) {
    throw new BadRequestError('Account registration is not configured. Run the database seed first.');
  }

  let user;
  try {
    user = await authRepository.createUser({
      fullName,
      email,
      phone,
      passwordHash: await hashPassword(password),
      roleId: pendingRole.id,
      isActive: true,
    });
  } catch (err) {
    if (err.code === 'P2002') {
      const target = err.meta?.target;
      const targets = (Array.isArray(target) ? target : [target])
        .filter(Boolean)
        .map((field) => String(field).toLowerCase());

      if (targets.some((field) => field.includes('phone'))) {
        throw new ConflictError('An account with this phone number already exists');
      }
      if (targets.some((field) => field.includes('email'))) {
        throw new ConflictError('An account with this email already exists');
      }
      throw new ConflictError('An account with these details already exists');
    }
    throw err;
  }

  await writeAuditLog({
    actorId: user.id,
    action: 'register_pending_staff',
    entityType: 'user',
    entityId: user.id,
  });

  return { accountCreated: true, awaitingRoleAssignment: true, user: toPublicUser(user) };
}
