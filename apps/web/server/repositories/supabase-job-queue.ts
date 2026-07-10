import type { Job, JobQueue } from '@prana/operations';
import type { SupabaseClient } from '@supabase/supabase-js';

interface JobRow {
  id: string;
  job_type: string;
  payload: Record<string, unknown>;
  attempts: number;
}

/**
 * Uses `claim_next_job` (infrastructure/database/migrations/0020) for the
 * one operation that needs real row-locking; completion/failure are plain
 * single-row updates, which don't need it. Always run with the service-role
 * client — the `jobs` table's RLS is admin-select-only (migration 0015),
 * and workers aren't an admin dashboard session.
 */
export class SupabaseJobQueue implements JobQueue {
  constructor(private readonly client: SupabaseClient) {}

  async claimNext(jobType: string, workerId: string): Promise<Job | null> {
    const { data, error } = await this.client.rpc('claim_next_job', {
      p_job_type: jobType,
      p_worker: workerId,
    });
    if (error) throw new Error(error.message);
    if (!data || !(data as JobRow).id) return null;

    const row = data as JobRow;
    return { id: row.id, jobType: row.job_type, payload: row.payload, attempts: row.attempts };
  }

  async markCompleted(jobId: string): Promise<void> {
    const { error } = await this.client
      .from('jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', jobId);
    if (error) throw new Error(error.message);
  }

  async markFailed(jobId: string, errorMessage: string, nextRetryAt: Date | null): Promise<void> {
    const { error } = await this.client
      .from('jobs')
      .update({
        status: nextRetryAt ? 'queued' : 'failed',
        next_retry: nextRetryAt?.toISOString() ?? null,
        metadata: { last_error: errorMessage },
      })
      .eq('id', jobId);
    if (error) throw new Error(error.message);
  }
}
