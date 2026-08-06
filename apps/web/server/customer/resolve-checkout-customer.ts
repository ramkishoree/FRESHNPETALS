import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentCustomer } from '@/server/customer/current-customer';

export interface CheckoutContact {
  email: string;
  phone?: string | undefined;
  recipientName?: string | undefined;
}

export interface ResolvedCheckoutCustomer {
  customerId: string;
  isGuest: boolean;
}

/**
 * The `customers.id` an order should be attached to, whether or not
 * anyone is signed in.
 *
 * Ch.8 mandates guest checkout ("never force registration") while
 * `orders.customer_id` is NOT NULL, and `customers.user_id` being
 * nullable is the schema's deliberate answer to that — see
 * docs/database-schema.md. A guest gets a real customers row with no
 * `user_id`; if they register later, `ensureCustomerProfile` adopts that
 * same row so their order history is already there.
 *
 * Guests are matched on email so a repeat buyer who never registers
 * accumulates one customer record rather than one per order — which is
 * what makes lifetime_value and total_orders mean anything for them.
 * The row is created with the service-role client because `customers`
 * has no INSERT policy for `anon`: creating one is a trusted server
 * action, never a client insert.
 */
export async function resolveCheckoutCustomer(
  supabase: SupabaseClient,
  contact: CheckoutContact,
): Promise<ResolvedCheckoutCustomer> {
  const signedIn = await getCurrentCustomer(supabase);
  if (signedIn) return { customerId: signedIn.id, isGuest: false };

  const email = contact.email.trim().toLowerCase();
  const admin = createSupabaseAdminClient();

  // Only ever adopt a row that is itself a guest. A registered
  // customer's row must never be hijacked by someone typing their email
  // into a guest checkout.
  const { data: existingGuest } = await admin
    .from('customers')
    .select('id')
    .eq('email', email)
    .is('user_id', null)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingGuest) return { customerId: existingGuest.id, isGuest: true };

  const [firstName, ...rest] = (contact.recipientName ?? '').trim().split(/\s+/).filter(Boolean);

  const { data: created, error } = await admin
    .from('customers')
    .insert({
      email,
      ...(contact.phone ? { phone: contact.phone } : {}),
      ...(firstName ? { first_name: firstName } : {}),
      ...(rest.length > 0 ? { last_name: rest.join(' ') } : {}),
    })
    .select('id')
    .single();

  if (error || !created) {
    throw new Error(`Failed to create a guest customer: ${error?.message ?? 'unknown error'}`);
  }

  return { customerId: created.id, isGuest: true };
}
