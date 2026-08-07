import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  sessionId: string;
}

/**
 * Payment parameters for a checkout session that is still open, so a
 * customer whose first attempt failed can retry on the *same* Razorpay
 * order.
 *
 * Sending them back to `/checkout` instead would start a fresh session
 * and reserve the stock a second time, leaving the abandoned reservation
 * to sit until the expiry sweep reclaims it — on a low-stock item a
 * customer could block themselves out of the very thing they are trying
 * to buy. Razorpay accepts multiple attempts against one order, which is
 * exactly why `payment.failed` deliberately leaves the session open, so
 * the retry has something to reuse.
 *
 * Nothing here is derived from the client: the amount comes from the
 * session's own pricing snapshot, so a retry cannot be steered to a
 * different price than the one the reservation was made at.
 */
const getPaymentParams = createApiRoute<undefined, unknown, undefined, RouteParams>({
  handler: async ({ params, request }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    const guestToken = new URL(request.url).searchParams.get('t');

    if (!customer && !guestToken)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const client = customer ? supabase : createSupabaseAdminClient();
    let query = client
      .from('checkout_sessions')
      .select('id, status, pricing_snapshot, metadata, reservation_expires_at')
      .eq('id', params.sessionId);
    if (customer) query = query.eq('customer_id', customer.id);

    const { data: session, error } = await query.maybeSingle();
    if (error)
      return err(
        new InfrastructureError('Failed to load checkout session.', { cause: error.message }),
      );
    if (!session)
      return err(new BusinessRuleError('Checkout session not found.', { httpStatus: 404 }));

    if (!customer) {
      const expected = (session.metadata as { guestToken?: string } | null)?.guestToken;
      if (!expected || expected !== guestToken)
        return err(new BusinessRuleError('Checkout session not found.', { httpStatus: 404 }));
    }

    if (session.status !== 'payment_pending') {
      // 'completed' means the webhook already made the order — retrying
      // would be a second charge. Anything else is cancelled/expired.
      return err(
        new BusinessRuleError('This checkout can no longer be paid. Please start again.', {
          httpStatus: 409,
        }),
      );
    }

    if (
      session.reservation_expires_at &&
      new Date(session.reservation_expires_at).getTime() <= Date.now()
    ) {
      return err(
        new BusinessRuleError('Your basket reservation has expired. Please start again.', {
          httpStatus: 409,
        }),
      );
    }

    const razorpayOrderId = (session.metadata as { razorpayOrderId?: string } | null)
      ?.razorpayOrderId;
    if (!razorpayOrderId) {
      return err(
        new BusinessRuleError('This checkout has no payment to retry. Please start again.', {
          httpStatus: 409,
        }),
      );
    }

    const grandTotal = Number(
      (session.pricing_snapshot as { grandTotal?: number | string } | null)?.grandTotal ?? 0,
    );
    if (!Number.isFinite(grandTotal) || grandTotal <= 0) {
      return err(
        new InfrastructureError('Checkout session has no usable pricing snapshot.', {
          cause: `sessionId=${session.id}`,
        }),
      );
    }

    return ok({
      checkoutSessionId: session.id,
      razorpayOrderId,
      razorpayKeyId: process.env['RAZORPAY_KEY_ID'] ?? '',
      // Razorpay works in the currency's smallest unit.
      amount: Math.round(grandTotal * 100),
      currency: 'INR',
    });
  },
});

export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  // A guest retrying a failed payment has no session — they present the
  // token issued at checkout instead, checked against this exact session
  // in the handler.
  const blocked = await runSecurityChain(request, { tier: 'authenticated' });
  if (blocked) return blocked;
  return getPaymentParams(request, await context.params);
}
