/**
 * Ch.10 §127/Ch.11 §14: background workers process the `jobs` queue and
 * "are idempotent". Framework-agnostic contract — the Supabase-backed
 * implementation (which needs the `claim_next_job` Postgres function, see
 * infrastructure/database/migrations/0020) lives in apps/web/server, same
 * split as every other repository in this codebase.
 */

export interface Job<TPayload = Record<string, unknown>> {
  id: string;
  jobType: string;
  payload: TPayload;
  attempts: number;
}

export interface JobQueue {
  claimNext(jobType: string, workerId: string): Promise<Job | null>;
  markCompleted(jobId: string): Promise<void>;
  markFailed(jobId: string, errorMessage: string, nextRetryAt: Date | null): Promise<void>;
}

export type JobHandler<TPayload = Record<string, unknown>> = (job: Job<TPayload>) => Promise<void>;

export type JobOutcome = 'processed' | 'empty' | 'failed';

const MAX_BACKOFF_SECONDS = 3600;
const BASE_BACKOFF_SECONDS = 30;

/**
 * Claims and processes exactly one job. Backoff is exponential
 * (attempts²·30s, capped at 1h) — the handler itself is responsible for
 * being safe to run twice (idempotent), since a crash between "handler
 * succeeded" and "markCompleted" would otherwise double-process on retry.
 */
export async function processNextJob(
  queue: JobQueue,
  jobType: string,
  workerId: string,
  handler: JobHandler,
): Promise<JobOutcome> {
  const job = await queue.claimNext(jobType, workerId);
  if (!job) return 'empty';

  try {
    await handler(job);
    await queue.markCompleted(job.id);
    return 'processed';
  } catch (cause) {
    const backoffSeconds = Math.min(job.attempts ** 2 * BASE_BACKOFF_SECONDS, MAX_BACKOFF_SECONDS);
    await queue.markFailed(
      job.id,
      cause instanceof Error ? cause.message : String(cause),
      new Date(Date.now() + backoffSeconds * 1000),
    );
    return 'failed';
  }
}
