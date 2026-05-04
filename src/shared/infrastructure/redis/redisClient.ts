import { Redis } from 'ioredis';
import type { RedisClient } from 'hono-rate-limiter';
import { logger } from '../logger.js';

let client: Redis | null = null;

export function getRawRedisClient(): Redis | null {
  const url = process.env['REDIS_URL'];
  if (!url) return null;

  if (!client) {
    client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null });
    client.on('error', (err: unknown) => logger.error({ err }, 'redis error'));
  }

  return client;
}

export function getRedisClient(): RedisClient | null {
  const url = process.env['REDIS_URL'];
  if (!url) return null;

  if (!client) {
    client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null });
    client.on('error', (err: unknown) => logger.error({ err }, 'redis error'));
  }

  const r = client;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapper: RedisClient = {
    scriptLoad: (script: string) => r.call('SCRIPT', 'LOAD', script) as Promise<string>,
    evalsha: (sha1: string, keys: string[], args: any[]) =>
      r.evalsha(sha1, keys.length, ...(keys as any[]), ...(args as any[])) as Promise<any>,
    decr: (key: string) => r.decr(key),
    del: (key: string) => r.del(key),
  };

  return wrapper;
}

export async function closeRedisClient(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
