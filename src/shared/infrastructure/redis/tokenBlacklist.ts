import { getRawRedisClient } from './redisClient.js';
import { logger } from '../logger.js';

const KEY_PREFIX = 'jti:blacklist:';

export async function addToBlacklist(jti: string, ttlSeconds: number): Promise<void> {
  const redis = getRawRedisClient();
  if (!redis) {
    logger.warn({ jti }, 'token blacklist: Redis not available, skipping revocation');
    return;
  }
  try {
    await redis.set(`${KEY_PREFIX}${jti}`, '1', 'EX', ttlSeconds);
  } catch (err) {
    logger.error({ err, jti }, 'token blacklist: failed to add token');
  }
}

export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const redis = getRawRedisClient();
  if (!redis) return false; // Fail open — if Redis is down, don't block valid requests
  try {
    const result = await redis.exists(`${KEY_PREFIX}${jti}`);
    return result === 1;
  } catch (err) {
    logger.error({ err, jti }, 'token blacklist: failed to check token');
    return false; // Fail open on Redis errors
  }
}
