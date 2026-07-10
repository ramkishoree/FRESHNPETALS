import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
}

/** Ch.16 §78 Order Tracking API. */
const getTracking = createApiRoute<undefined, unknown, undefined, RouteParams>({
  handler: async ({ params }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { data: order } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', params.id)
      .eq('customer_id', customer.id)
      .maybeSingle();
    if (!order) return err(new BusinessRuleError('Order not found.', { httpStatus: 404 }));

    const [deliveryResult, eventsResult] = await Promise.all([
      supabase
        .from('deliveries')
        .select('status, estimated_delivery, actual_delivery, tracking_code')
        .eq('order_id', params.id)
        .maybeSingle(),
      supabase
        .from('order_events')
        .select('new_state, created_at')
        .eq('order_id', params.id)
        .order('created_at', { ascending: true }),
    ]);
    if (deliveryResult.error || eventsResult.error) {
      return err(
        new InfrastructureError('Failed to load tracking.', {
          cause: deliveryResult.error?.message ?? eventsResult.error?.message,
        }),
      );
    }
    const delivery = deliveryResult.data;
    const events = eventsResult.data;

    return ok({
      status: order.status,
      delivery: delivery ?? null,
      timeline: events ?? [],
    });
  },
});

export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return getTracking(request, await context.params);
}
