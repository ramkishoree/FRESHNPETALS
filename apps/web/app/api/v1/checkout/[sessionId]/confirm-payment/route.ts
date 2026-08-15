import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { logger } from '@/server/logger';
import { runPostOrderSideEffects } from '@/server/orders/run-post-order-side-effects';
import { fetchRazorpayPayment, verifyPaymentSignature } from '@/server/payments/razorpay-adapter';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  sessionId: string;
}

const bodySchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

/**
 * Turns a finished Razorpay widget into an order, without waiting for the
 * webhook.
 *
 * The webhook was the only path that ever created an order from an online
 * payment, which is correct right up until it isn't delivered: every
 * completed order on this site so far has been cash on delivery, and a
 * customer who paid online sat on "Arranging your order" forever because
 * nothing was ever going to arrive to end the wait.
 *
 * This does not weaken the rule that the frontend is never trusted. The
 * browser only says "look now" — it supplies no amount, no status, and
 * nothing that survives on its own:
 *
 *   1. The callback's HMAC is recomputed with the API secret, so the
 *      payload has to have come from Razorpay.
 *   2. The payment is then fetched from Razorpay directly, and the
 *      amount and captured status are read from *that* answer.
 *   3. The order id has to match the one this session recorded when it
 *      created the Razorpay order, so a real payment for someone else's
 *      checkout cannot be replayed onto this one.
 *
 * The webhook stays exactly as it was and remains the backstop for the
 * customer who closes the tab the instant they pay. Both paths land in
 * `checkout_complete`, whose `payments.idempotency_key` uniqueness makes
 * a double arrival resolve to the same single order.
 */
const confirmPayment = createApiRoute<
  undefined,
  { status: string; orderId: string | null; orderNumber: string | null },
  z.infer<typeof bodySchema>,
  RouteParams
>({
  bodySchema,
  handler: async ({ body, params, request }) => {
    const correlationId = crypto.randomUUID();
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    const guestToken = new URL(request.url).searchParams.get('t');

    // Guests have no session to scope by, so the admin client does the
    // read and the token below is what actually authorises it.
    const admin = createSupabaseAdminClient();
    const { data: session, error: sessionError } = await admin
      .from('checkout_sessions')
      .select('id, status, customer_id, metadata')
      .eq('id', params.sessionId)
      .maybeSingle();

    if (sessionError)
      return err(
        new InfrastructureError('Failed to load checkout session.', {
          cause: sessionError.message,
        }),
      );
    if (!session)
      return err(new BusinessRuleError('Checkout session not found.', { httpStatus: 404 }));

    const metadata = (session.metadata ?? {}) as {
      razorpayOrderId?: string;
      guestToken?: string;
    };

    const ownsSession = customer
      ? session.customer_id === customer.id
      : Boolean(metadata.guestToken) && metadata.guestToken === guestToken;
    if (!ownsSession)
      return err(new BusinessRuleError('Checkout session not found.', { httpStatus: 404 }));

    // Already done — by the webhook, or by this route on a previous
    // attempt. Answer with the order rather than trying again.
    if (session.status === 'completed') return ok(await describeOutcome(admin, params.sessionId));

    if (!metadata.razorpayOrderId || metadata.razorpayOrderId !== body.razorpayOrderId)
      return err(new BusinessRuleError('That payment is for a different checkout.'));

    if (
      !verifyPaymentSignature({
        razorpayOrderId: body.razorpayOrderId,
        razorpayPaymentId: body.razorpayPaymentId,
        razorpaySignature: body.razorpaySignature,
      })
    ) {
      logger.warn('checkout.confirm_payment.bad_signature', {
        correlationId,
        checkoutSessionId: params.sessionId,
      });
      return err(new BusinessRuleError('Payment could not be verified.', { httpStatus: 400 }));
    }

    let payment: Awaited<ReturnType<typeof fetchRazorpayPayment>>;
    try {
      payment = await fetchRazorpayPayment(body.razorpayPaymentId);
    } catch (cause) {
      // The webhook can still finish this order, and the page the
      // customer is on keeps polling, so a Razorpay API blip is a
      // "not yet", never a failed order.
      logger.error('checkout.confirm_payment.fetch_failed', {
        correlationId,
        checkoutSessionId: params.sessionId,
        message: cause instanceof Error ? cause.message : String(cause),
      });
      return err(
        new InfrastructureError('Could not reach the payment provider.', {
          cause: cause instanceof Error ? cause.message : String(cause),
        }),
      );
    }

    if (payment.orderId !== body.razorpayOrderId)
      return err(new BusinessRuleError('That payment is for a different checkout.'));

    if (payment.status !== 'captured') {
      logger.warn('checkout.confirm_payment.not_captured', {
        correlationId,
        checkoutSessionId: params.sessionId,
        // Not `status` — the logger reserves that for the HTTP status.
        paymentStatus: payment.status,
      });
      return ok({ status: session.status, orderId: null, orderNumber: null });
    }

    const { data: order, error: rpcError } = await admin.rpc('checkout_complete', {
      p_checkout_session_id: session.id,
      p_razorpay_order_id: body.razorpayOrderId,
      p_razorpay_payment_id: payment.id,
      p_razorpay_signature: body.razorpaySignature,
      // From Razorpay's own record of the capture, not from the browser.
      p_amount: payment.amount / 100,
    });

    if (rpcError)
      return err(
        new InfrastructureError('Failed to complete the order.', { cause: rpcError.message }),
      );

    // Awaited for the same reason the webhook awaits it: a serverless
    // function can be frozen the moment it responds, killing an
    // unawaited promise before the alert or invoice ever goes out.
    if (order) await runPostOrderSideEffects(admin, order, correlationId);

    return ok(await describeOutcome(admin, params.sessionId));
  },
});

async function describeOutcome(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  sessionId: string,
) {
  const { data: order } = await admin
    .from('orders')
    .select('id, order_number')
    .eq('checkout_session_id', sessionId)
    .maybeSingle();
  return {
    status: 'completed',
    orderId: order?.id ?? null,
    orderNumber: order?.order_number ?? null,
  };
}

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated' });
  if (blocked) return blocked;
  return confirmPayment(request, await context.params);
}
