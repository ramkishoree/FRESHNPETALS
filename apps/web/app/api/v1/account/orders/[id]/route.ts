import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
}

/** Ch.16 §77: "Owner Only" — RLS's `orders_select_own` policy is the actual enforcement; a non-owner's request for someone else's order id returns null here, surfaced as 404, not another customer's data. */
const getOrder = createApiRoute<undefined, unknown, undefined, RouteParams>({
  handler: async ({ params }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { data, error } = await supabase
      .from('orders')
      .select(
        'id, order_number, status, payment_status, subtotal, discount_total, delivery_fee, tax_total, grand_total, currency, notes, created_at, order_items(id, product_name, sku, quantity, unit_price, line_total), invoices(id, invoice_number, invoice_url), deliveries(id, status, estimated_delivery, actual_delivery, tracking_code)',
      )
      .eq('id', params.id)
      .eq('customer_id', customer.id)
      .maybeSingle();

    if (error)
      return err(new InfrastructureError('Failed to load order.', { cause: error.message }));
    if (!data) return err(new BusinessRuleError('Order not found.', { httpStatus: 404 }));
    return ok(data);
  },
});

export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return getOrder(request, await context.params);
}
