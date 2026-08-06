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

  // Adopt the guest row this person already has, rather than opening a
  // second one. Someone who bought as a guest and registers afterwards
  // expects to find that order in their history — and two customer rows
  // for one human also splits lifetime_value and total_orders. Only
  // unclaimed rows (`user_id is null`) are eligible, so registering can
  // never take over an account that already belongs to someone.
  if (email) {
    const { data: guestRow } = await admin
      .from('customers')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .is('user_id', null)
      .is('deleted_at', null)
      .maybeSingle();

    if (guestRow) {
      await admin.from('customers').update({ user_id: userId }).eq('id', guestRow.id);
      return;
    }
  }

  await admin.from('customers').insert({ user_id: userId, email });
}
