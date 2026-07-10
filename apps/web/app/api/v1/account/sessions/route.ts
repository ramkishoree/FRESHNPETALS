import { err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/** Ch.16 §84 Session Management API. */
const listSessions = createApiRoute({
  handler: async () => {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('sessions')
      .select('id, device_name, os, browser, last_activity, created_at, expires_at')
      .eq('user_id', user?.id ?? '')
      .is('revoked_at', null)
      .order('last_activity', { ascending: false });
    if (error)
      return err(new InfrastructureError('Failed to load sessions.', { cause: error.message }));
    return ok(data ?? []);
  },
});

/**
 * Ch.16 §84: "Revoke All Other Sessions... current session remains
 * active unless explicitly revoked." This app-level `sessions` table
 * (Phase 4) has no "this is the row for the request I'm handling right
 * now" marker — Supabase's own JWT is what's actually live, this table
 * is bookkeeping alongside it — so a true "all *other*" revoke isn't
 * distinguishable yet. Revokes every tracked session for the user;
 * wiring a current-session cookie to exclude one is a follow-up, not
 * silently pretended to work here.
 */
const revokeAllSessions = createApiRoute({
  handler: async () => {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', user?.id ?? '')
      .is('revoked_at', null);
    if (error)
      return err(new InfrastructureError('Failed to revoke sessions.', { cause: error.message }));
    return ok({ revoked: true });
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return listSessions(request);
}

export async function DELETE(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return revokeAllSessions(request);
}
