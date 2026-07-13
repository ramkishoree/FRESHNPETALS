import { timingSafeEqual } from 'node:crypto';
import { processNextJob } from '@prana/operations';
import { NextResponse, type NextRequest } from 'next/server';
import { getServerEnv } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/server/logger';
import { SupabaseJobQueue } from '@/server/repositories/supabase-job-queue';
import { handleInvoiceGenerate } from '@/server/invoices/generate-invoice-job';
import { sweepGoogleReviews } from '@/server/outlets/google-reviews-sweep';
import { sweepUsageThresholds } from '@/server/ops/usage-threshold-sweep';
import { sweepReviewRequestNudges } from '@/server/reviews/review-nudge-sweep';

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

/** Handlers that need the admin client are built per-invocation, not as a
 * module-level const, since the client itself is request-scoped. */
function buildJobHandlers(
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Record<string, (job: { payload: Record<string, unknown> }) => Promise<void>> {
  return {
    'sample.ping': handleSamplePing,
    'invoice.generate': (job) => handleInvoiceGenerate(admin, job),
  };
}

/**
 * Ch.8 §41 "Reservation expires automatically" — a periodic sweep, not a
 * discrete enqueued job (nothing ever enqueues "check for abandoned
 * carts"; it just needs to run every cron tick). Vercel Hobby's cron cap
 * is once-daily, so an abandoned checkout's stock can stay reserved for
 * up to ~24h rather than the intended 15 minutes — far better than the
 * "forever" this replaces, but worth a tighter external trigger later if
 * that gap ever matters in practice.
 */
async function sweepExpiredReservations(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await admin.rpc('checkout_expire_stale_sessions', {
    p_batch_limit: 500,
  });
  if (error) {
    logger.error('worker.reservation_sweep_failed', { message: error.message });
    return;
  }
  logger.info('worker.reservation_sweep', { releasedCount: data });
}

async function runWorker(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  const env = getServerEnv();
  if (!isAuthorized(authHeader, env.CRON_SECRET)) {
    return NextResponse.json(
      { success: false, data: null, meta: null, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const admin = createSupabaseAdminClient();
  const queue = new SupabaseJobQueue(admin);
  const workerId = `vercel-cron-${crypto.randomUUID().slice(0, 8)}`;
  const outcomes: Record<string, number> = { processed: 0, empty: 0, failed: 0 };

  await sweepExpiredReservations(admin);
  await sweepReviewRequestNudges(admin);
  await sweepGoogleReviews(admin);
  await sweepUsageThresholds(admin);

  const jobHandlers = buildJobHandlers(admin);
  for (const jobType of Object.keys(jobHandlers)) {
    for (let i = 0; i < MAX_JOBS_PER_INVOCATION; i++) {
      const handler = jobHandlers[jobType];
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
