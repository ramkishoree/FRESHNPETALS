import 'server-only';
import { Redis } from '@upstash/redis';
import { getServerEnv } from '@/config/env';

let client: Redis | undefined;

/** Ch.10 §3: Redis (Upstash) — sessions, rate limiting, search, caching. */
export function getRedisClient(): Redis {
  if (!client) {
    const env = getServerEnv();
    client = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
  }
  return client;
}

/** Cache-aside: return the cached value, or compute, store, and return it. */
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const redis = getRedisClient();
  const cached = await redis.get<T>(key);
  if (cached !== null) return cached;

  const value = await compute();
  await redis.set(key, value, { ex: ttlSeconds });
  return value;
}
