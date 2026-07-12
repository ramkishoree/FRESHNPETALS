import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/config/env';
import { fetchWithTimeout } from '@/lib/supabase/fetch-with-timeout';

/**
 * Service-role Supabase client. Bypasses RLS entirely (BYPASSRLS grant on
 * service_role, see infrastructure/database/migrations/0010) — never import
 * this from a Client Component, never expose its result to a client
 * response. Used for: pre-auth lockout checks (the user isn't authenticated
 * yet, so their own login_history RLS policy can't apply), and later by
 * Phase 5 backend services that need to act with full trust.
 *
 * `getServerEnv()` already throws at runtime if called client-side — the
 * `server-only` import adds a build-time guard on top, so a client
 * component that accidentally imports this module fails the build
 * immediately instead of only throwing if that code path actually runs
 * in a browser.
 */
export function createSupabaseAdminClient() {
  const env = getServerEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: { fetch: fetchWithTimeout },
  });
}
