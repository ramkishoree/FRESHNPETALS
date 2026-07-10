import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { getRedisClient } from '@/lib/redis';

/**
 * Ch.16 §19 concrete limits (this file uses these — Ch.14/15 gives a
 * slightly different admin figure, 30/min vs. 100/min here; the API-spec
 * chapter is the more specific authority for API-layer limits, so its
 * number wins — see docs/backend-architecture.md).
 */
export const RATE_LIMIT_TIERS = {
  anonymous: { limit: 200, windowSeconds: 60 },
  authenticated: { limit: 500, windowSeconds: 60 },
  login: { limit: 10, windowSeconds: 900 },
  checkout: { limit: 20, windowSeconds: 60 },
  admin: { limit: 100, windowSeconds: 60 },
} as const;

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS;

const limiters = new Map<RateLimitTier, Ratelimit>();

function getLimiter(tier: RateLimitTier): Ratelimit {
  let limiter = limiters.get(tier);
  if (!limiter) {
    const { limit, windowSeconds } = RATE_LIMIT_TIERS[tier];
    limiter = new Ratelimit({
      redis: getRedisClient(),
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: `ratelimit:${tier}`,
    });
    limiters.set(tier, limiter);
  }
  return limiter;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
}

/** `identifier` is typically a hashed IP or a user id — never a raw IP. */
export async function checkRateLimit(
  tier: RateLimitTier,
  identifier: string,
): Promise<RateLimitResult> {
  const { success, limit, remaining } = await getLimiter(tier).limit(identifier);
  return { success, limit, remaining };
}
