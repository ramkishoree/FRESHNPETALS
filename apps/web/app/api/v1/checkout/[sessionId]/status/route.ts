import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  sessionId: string;
}

/**
 * Ch.8 §89 Principle 5: order creation happens only from the verified
 * webhook, never the frontend's payment-success callback — so the
 * frontend has nothing to trust after Razorpay's checkout.js resolves
 * except "wait and ask the server." This is what it polls.
 */
const getStatus = createApiRoute<undefined, unknown, undefined, RouteParams>({
  handler: async ({ params }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { data: session, error } = await supabase
      .from('checkout_sessions')
      .select('id, status, customer_id')
      .eq('id', params.sessionId)
      .eq('customer_id', customer.id)
      .maybeSingle();
    if (error)
      return err(
        new InfrastructureError('Failed to load checkout status.', { cause: error.message }),
      );
    if (!session)
      return err(new BusinessRuleError('Checkout session not found.', { httpStatus: 404 }));

    if (session.status !== 'completed') {
      return ok({ status: session.status, orderId: null, orderNumber: null });
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id, order_number')
      .eq('checkout_session_id', params.sessionId)
      .maybeSingle();

    return ok({
      status: session.status,
      orderId: order?.id ?? null,
      orderNumber: order?.order_number ?? null,
    });
  },
});

export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return getStatus(request, await context.params);
}
