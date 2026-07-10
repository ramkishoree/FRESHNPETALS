import { timingSafeEqual } from 'node:crypto';
import { processNextJob } from '@prana/operations';
import { NextResponse, type NextRequest } from 'next/server';
import { getServerEnv } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/server/logger';
import { SupabaseJobQueue } from '@/server/repositories/supabase-job-queue';

function isAuthorized(authHeader: string | null, cronSecret: string): boolean {
  const expected = `Bearer ${cronSecret}`;
  const provided = authHeader ?? '';
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Internal-only: triggered by Vercel Cron (Phase 13 wires the schedule),
 * never by a browser — auth is a shared secret, not a user session.
 *
 * `sample.ping` is a deliberately trivial job type proving the queue
 * mechanism end-to-end (claim → handle → complete/retry). Real job types
 * (email, image optimization, embeddings, invoices — Ch.11 §14) get
 * registered here as their owning feature phase (6, 9, 10) implements
 * them; this is the scaffold they plug into, not a placeholder pretending
 * to be a real job.
 */
const MAX_JOBS_PER_INVOCATION = 10;

async function handleSamplePing(job: { payload: Record<string, unknown> }): Promise<void> {
  logger.info('worker.sample_ping', { payload: job.payload });
}

const JOB_HANDLERS: Record<string, (job: { payload: Record<string, unknown> }) => Promise<void>> = {
  'sample.ping': handleSamplePing,
};

async function runWorker(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  const env = getServerEnv();
  if (!isAuthorized(authHeader, env.CRON_SECRET)) {
    return NextResponse.json(
      { success: false, data: null, meta: null, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const queue = new SupabaseJobQueue(createSupabaseAdminClient());
  const workerId = `vercel-cron-${crypto.randomUUID().slice(0, 8)}`;
  const outcomes: Record<string, number> = { processed: 0, empty: 0, failed: 0 };

  for (const jobType of Object.keys(JOB_HANDLERS)) {
    for (let i = 0; i < MAX_JOBS_PER_INVOCATION; i++) {
      const handler = JOB_HANDLERS[jobType];
      if (!handler) break;
      const outcome = await processNextJob(queue, jobType, workerId, handler);
      outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
      if (outcome === 'empty') break;
    }
  }

  return NextResponse.json({ success: true, data: outcomes, meta: null, error: null });
}

// Vercel Cron Jobs only ever send GET (https://vercel.com/docs/cron-jobs) —
// GET is the schedule-triggered path, POST stays available for a manual
// operator-triggered run with the same shared-secret check.
export const GET = runWorker;
export const POST = runWorker;
