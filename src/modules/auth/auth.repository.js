import { prisma } from '../../config/database.js';

export const authRepository = {
  findActiveUserByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
  },

  findUserById(id) {
    return prisma.user.findUnique({
      where: { id },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
  },

  findRoleByName(name) {
    return prisma.role.findUnique({ where: { name } });
  },

  createUser(data) {
    return prisma.user.create({
      data,
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
  },

  touchLastLogin(userId) {
    return prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  },

  createRefreshToken({ userId, tokenHash, expiresAt, createdByIp }) {
    return prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt, createdByIp },
    });
  },

  findRefreshTokenByHash(tokenHash) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  revokeRefreshTokenById(id) {
    return prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  },

  revokeRefreshTokenByHash(tokenHash) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  revokeAllRefreshTokensForUser(userId) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  createPasswordResetToken({ userId, tokenHash, expiresAt }) {
    return prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
  },

  findPasswordResetTokenByHash(tokenHash) {
    return prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  },

  markPasswordResetTokenUsed(id) {
    return prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  },

  updateUserPassword(userId, passwordHash) {
    return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  },
};
