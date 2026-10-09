import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

// Access tokens are short-lived and carry the minimum claims needed to
// authorize a request without hitting the DB on every call (id, role).
// Refresh tokens are opaque-looking JWTs too, but are also stored hashed in
// the `refresh_tokens` table so they can be revoked server-side (Phase 2).
export function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.JWT_REFRESH_EXPIRES_IN_DAYS}d`,
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}