import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CurrentCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

/**
 * Ch.16 §71: "Customers may only access their own resources... enforced
 * server-side." Every account/* route needs the caller's `customers.id`
 * (not their `auth.uid()`) to scope its query/insert — this reads it
 * through the caller's own session client, so `customers_select_own`'s
 * RLS policy (user_id = auth.uid()) is what actually decides whether the
 * row comes back, not application logic alone.
 */
export async function getCurrentCustomer(
  supabase: SupabaseClient,
): Promise<CurrentCustomer | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, phone')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email,
    phone: data.phone,
  };
}

export async function requireCurrentCustomer(supabase: SupabaseClient): Promise<CurrentCustomer> {
  const customer = await getCurrentCustomer(supabase);
  if (!customer) throw new Error('No customer profile for the current session.');
  return customer;
}
