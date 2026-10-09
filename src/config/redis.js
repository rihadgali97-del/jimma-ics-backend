import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../common/utils/logger.js';

// Shared Redis connection used for caching (§dashboard stats, nisab rates,
// public listing caches) and as the base connection config for BullMQ.
export const redis = new Redis(env.REDIS_URL, {
  // Cache reads are optional, so fail them promptly when Redis is offline.
  // BullMQ workers should use their own connection with maxRetriesPerRequest: null.
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  retryStrategy(times) {
    // Stop reconnecting in the background; the next cache operation can retry.
    return times <= 3 ? Math.min(times * 250, 1000) : null;
  },
});

redis.on('error', (err) => {
  logger.warn({ err }, 'Redis unavailable; cache operations will fall back to the database');
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});
