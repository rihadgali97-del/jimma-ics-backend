import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';

// Default limiter applied to the whole API.
export const defaultRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later' },
  },
});

// Tighter limiter for unauthenticated, abuse-prone endpoints: login,
// public application submission (Nikah/Zakat/Janazah), broadcast subscribe.
export function strictRateLimiter({ windowMs = 15 * 60 * 1000, max = 10 } = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later' },
    },
  });
}