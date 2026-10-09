import { redis } from '../../config/redis.js';
import { logger } from './logger.js';

/**
 * Returns the cached value for `key` if present; otherwise calls `compute`,
 * caches the result for `ttlSeconds`, and returns it. Used for expensive
 * aggregate queries (dashboard stats) and public listings that don't need
 * to be real-time-fresh (current Nisab rate, mosque/madrasa directories).
 *
 * If Redis is unreachable, falls back to calling `compute` directly rather
 * than failing the request — caching is a performance optimization, not a
 * dependency the API should go down over.
 */
export async function getOrSetCache(key, ttlSeconds, compute) {
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached);
    }
  } catch (err) {
    logger.warn({ err, key }, 'Cache read failed — falling back to direct compute');
  }

  const value = await compute();

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, 'Cache write failed — continuing without caching this result');
  }

  return value;
}

/** Invalidates one or more cache keys — call after a write that affects a cached read. */
export async function invalidateCache(...keys) {
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    logger.warn({ err, keys }, 'Cache invalidation failed');
  }
}