import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicEnv } from '@/config/env';
import { fetchWithTimeout } from '@/lib/supabase/fetch-with-timeout';

/**
 * Server Component / Server Action / Route Handler Supabase client. Reads
 * the caller's session from cookies — every query runs as `authenticated`
 * (or `anon`) and is subject to RLS, same as the browser client.
 *
 * Cookie writes fail silently when called from a Server Component (which
 * cannot set cookies) — that's expected; the session is refreshed instead
 * in proxy.ts, which runs before the component tree renders.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { fetch: fetchWithTimeout },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component; proxy.ts refreshes instead.
        }
      },
    },
  });
}
