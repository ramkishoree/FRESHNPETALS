import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getRedisClient } from '@/lib/redis';
import { logger } from '@/server/logger';

/**
 * Ch.18 §20 Health Check Verification / Ch.17 §237 Application
 * Verification — the single endpoint the deployment pipeline's Step 6
 * ("Verify application startup"), Vercel's health checks, and any
 * external uptime monitor all point at. Deliberately unauthenticated
 * (monitoring services can't hold a session) and outside
 * `runSecurityChain` (health checks are polled far more often than a
 * normal request and shouldn't compete with real traffic for the
 * anonymous rate-limit budget) — but it does no writes and leaks no
 * internals beyond up/down per dependency.
 */
export const dynamic = 'force-dynamic';

interface CheckResult {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}

async function timed(check: () => Promise<void>): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    await check();
    return { status: 'up', latencyMs: Date.now() - startedAt };
  } catch (cause) {
    return {
      status: 'down',
      latencyMs: Date.now() - startedAt,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

export async function GET() {
  const [database, redis] = await Promise.all([
    timed(async () => {
      const admin = createSupabaseAdminClient();
      const { error } = await admin.from('system_settings').select('key').limit(1);
      if (error) throw new Error(error.message);
    }),
    timed(async () => {
      await getRedisClient().ping();
    }),
  ]);

  const checks = { database, redis };
  const healthy = Object.values(checks).every((c) => c.status === 'up');

  if (!healthy) {
    logger.warn('health.degraded', { checks });
  }

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 },
  );
}
