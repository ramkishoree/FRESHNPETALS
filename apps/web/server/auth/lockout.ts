import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/** Ch.15 §81: 10 failed attempts / 15 minutes → temporary lock. */
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_WINDOW_MINUTES = 15;

export interface LockoutStatus {
  locked: boolean;
  failedAttempts: number;
}

/**
 * Keyed by the raw identifier typed at the login form (email), not
 * user_id — the user isn't authenticated yet, and the identifier may not
 * even match a real account (see migration 0019's rationale).
 */
export async function checkLockout(identifier: string): Promise<LockoutStatus> {
  const admin = createSupabaseAdminClient();
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60_000).toISOString();

  const { count } = await admin
    .from('login_history')
    .select('id', { count: 'exact', head: true })
    .eq('attempted_identifier', identifier.toLowerCase())
    .eq('success', false)
    .gte('occurred_at', windowStart);

  const failedAttempts = count ?? 0;
  return { locked: failedAttempts >= MAX_FAILED_ATTEMPTS, failedAttempts };
}

export async function recordLoginAttempt(params: {
  identifier: string;
  userId: string | null;
  success: boolean;
  failureReason?: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from('login_history').insert({
    attempted_identifier: params.identifier.toLowerCase(),
    user_id: params.userId,
    success: params.success,
    failure_reason: params.failureReason ?? null,
  });
}
