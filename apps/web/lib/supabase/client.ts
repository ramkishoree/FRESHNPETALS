import { createBrowserClient } from '@supabase/ssr';
import { getPublicEnv } from '@/config/env';

/**
 * Client Component Supabase client. Uses the anon key only — every table
 * read/write through this client is subject to RLS (Ch.10 §33/§80).
 */
export function createSupabaseBrowserClient() {
  const env = getPublicEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
