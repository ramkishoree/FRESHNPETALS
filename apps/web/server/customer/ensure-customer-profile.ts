import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * `public.users` gets auto-provisioned by the `on_auth_user_created`
 * trigger (migration 0004) the moment Supabase Auth creates a row — but
 * `customers` is a commerce-domain concept that trigger deliberately
 * doesn't reach into, and its RLS (migration 0012) has no INSERT policy
 * for `authenticated` at all (only `service_role`/admin) — customer-row
 * creation is meant to be a trusted server action, never a client
 * insert. Called from both the auth callback (email verification/OAuth)
 * and password sign-in, since either can be the first time a session
 * exists for a user who has no `customers` row yet.
 *
 * Check-then-insert rather than an upsert: `idx_customers_user_id` is a
 * partial unique index (`where user_id is not null`), and Postgres's
 * `ON CONFLICT` target inference needs the same partial predicate
 * restated, which supabase-js's `.upsert()` has no option for.
 */
export async function ensureCustomerProfile(userId: string, email: string | null): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from('customers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return;

  await admin.from('customers').insert({ user_id: userId, email });
}
