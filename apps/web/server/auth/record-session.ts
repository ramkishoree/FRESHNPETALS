import 'server-only';
import { createHash } from 'node:crypto';
import type { Session } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/server/logger';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Records a `public.sessions` row for a freshly established session.
 *
 * This table is not Supabase's own session store — it backs the account
 * "signed-in devices" list and, more sharply, the admin session age
 * check in `proxy.ts`, which refuses `/admin` when the newest unrevoked
 * row is older than 12 hours.
 *
 * That check treats a *missing* row as infinitely old. Only the password
 * sign-in used to write one, so anyone arriving by Google or an email
 * link had no row at all and was bounced off `/admin` back to the login
 * page — where signing in again still wrote nothing, so it never
 * recovered. Enabling Google sign-in turned that latent gap into the
 * owner being locked out of their own admin panel.
 *
 * Best-effort by design: a failure here must never block a sign-in that
 * Supabase has already completed.
 */
export async function recordSession(session: Session): Promise<void> {
  try {
    const headerList = await headers();
    const forwardedFor = headerList.get('x-forwarded-for');

    const admin = createSupabaseAdminClient();
    await admin.from('sessions').insert({
      user_id: session.user.id,
      refresh_token_hash: hashToken(session.refresh_token),
      user_agent: headerList.get('user-agent'),
      // Ch.10 §71: hashed, never the raw IP.
      ip_address_hash: forwardedFor ? hashToken(forwardedFor) : null,
      expires_at: new Date((session.expires_at ?? 0) * 1000).toISOString(),
    });
  } catch (cause) {
    logger.error('auth.record_session_failed', {
      userId: session.user.id,
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }
}
