import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/redis', () => ({ getRedisClient: () => ({}) }));

const limitMock = vi.fn().mockResolvedValue({ success: true, limit: 200, remaining: 199 });

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(
    vi.fn().mockImplementation(() => ({ limit: limitMock })),
    { slidingWindow: vi.fn((limit: number, window: string) => ({ limit, window })) },
  ),
}));

const { RATE_LIMIT_TIERS, checkRateLimit } = await import('./rate-limit.js');

describe('RATE_LIMIT_TIERS', () => {
  it('matches the Ch.16 §19 documented limits', () => {
    expect(RATE_LIMIT_TIERS).toEqual({
      anonymous: { limit: 200, windowSeconds: 60 },
      authenticated: { limit: 500, windowSeconds: 60 },
      login: { limit: 10, windowSeconds: 900 },
      checkout: { limit: 20, windowSeconds: 60 },
      admin: { limit: 100, windowSeconds: 60 },
      // Not from Ch.16 §19: public review posting is unauthenticated and
      // accepts uploads, so it gets its own far tighter budget.
      review: { limit: 5, windowSeconds: 3600 },
      reviewEdit: { limit: 40, windowSeconds: 3600 },
    });
  });
});

describe('checkRateLimit', () => {
  it('delegates to the underlying limiter and returns its verdict', async () => {
    const result = await checkRateLimit('anonymous', '1.2.3.4');
    expect(result).toEqual({ success: true, limit: 200, remaining: 199 });
    expect(limitMock).toHaveBeenCalledWith('1.2.3.4');
  });
});
