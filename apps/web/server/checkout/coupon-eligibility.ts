import 'server-only';
import type { CouponEligibilityContext } from '@prana/commerce';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Shared by both the real checkout and the pricing preview so eligibility
 * (first_order/birthday coupon types — see checkout.ts's CouponEligibilityType)
 * is resolved identically in both places. Only queried when a coupon code
 * is actually present — no cost for the common no-coupon case. */
export async function resolveCouponEligibilityContext(
  admin: SupabaseClient,
  customerId: string,
): Promise<CouponEligibilityContext> {
  const [{ count: customerOrderCount }, { data: customerRow }] = await Promise.all([
    admin.from('orders').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
    admin.from('customers').select('date_of_birth').eq('id', customerId).maybeSingle(),
  ]);

  return {
    customerOrderCount: customerOrderCount ?? 0,
    customerDateOfBirth: customerRow?.date_of_birth ?? null,
  };
}
