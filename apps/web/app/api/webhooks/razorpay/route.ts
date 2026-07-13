import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/server/logger';
import { runPostOrderSideEffects } from '@/server/orders/run-post-order-side-effects';
import { verifyWebhookSignature } from '@/server/payments/razorpay-adapter';

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        status: string;
      };
    };
  };
}

/**
 * Ch.16 §136 Razorpay Webhooks — "Every webhook validates Signature,
 * Timestamp, Replay Protection, Order Mapping, Audit Log. Invalid
 * webhooks rejected." Ch.8 §89 Principle 5: this is the *only* path that
 * ever creates an order — the frontend's checkout.js success callback is
 * never trusted, so there's no separate client-submitted payment
 * signature to check here (that pattern is a different integration this
 * app deliberately doesn't use — see razorpay-adapter.ts's
 * verifyPaymentSignature, kept as a documented, unused-by-design utility).
 *
 * Order Mapping: `checkout_start` stores the Razorpay order id it just
 * created into `checkout_sessions.metadata.razorpayOrderId` (the only
 * point both ids are known together) — this webhook looks the session up
 * by that, not by a `payments` row (which doesn't exist until
 * `checkout_complete` creates it — this webhook call *is* what creates it).
 *
 * Replay/idempotency protection is `checkout_complete`'s job at the
 * database layer (its `payments.idempotency_key` uniqueness check), not
 * re-implemented here — a webhook delivered twice safely resolves to the
 * same order both times.
 */
export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  if (!verifyWebhookSignature(rawBody, signature)) {
    logger.warn('webhook.razorpay.invalid_signature', { correlationId });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: RazorpayWebhookPayload;
  try {
    event = JSON.parse(rawBody);
  } catch {
    logger.warn('webhook.razorpay.invalid_json', { correlationId });
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  try {
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const payment = event.payload.payment?.entity;
      if (!payment) {
        return NextResponse.json({ error: 'Missing payment entity' }, { status: 400 });
      }

      const { data: session } = await admin
        .from('checkout_sessions')
        .select('id')
        .eq('metadata->>razorpayOrderId', payment.order_id)
        .maybeSingle();

      if (!session) {
        logger.error('webhook.razorpay.session_not_found', {
          correlationId,
          razorpayOrderId: payment.order_id,
        });
        return NextResponse.json({ error: 'Unknown order' }, { status: 404 });
      }

      const { data: order, error: rpcError } = await admin.rpc('checkout_complete', {
        p_checkout_session_id: session.id,
        p_razorpay_order_id: payment.order_id,
        p_razorpay_payment_id: payment.id,
        p_razorpay_signature: '',
        p_amount: payment.amount / 100,
      });

      if (rpcError) {
        logger.error('webhook.razorpay.checkout_complete_failed', {
          correlationId,
          message: rpcError.message,
        });
        return NextResponse.json({ error: 'Failed to complete order' }, { status: 500 });
      }

      // Order-placed owner alert + invoice + confirmation email. Awaited
      // (not fire-and-forget) — a serverless function can be frozen the
      // instant it returns a response, which would kill an in-flight
      // unawaited promise before these side effects actually run.
      // runPostOrderSideEffects catches its own per-channel failures, so
      // awaiting it here can't turn a notification/invoice/email failure
      // into a webhook failure (Razorpay would just retry the whole
      // webhook, re-triggering checkout_complete's idempotency path for
      // no benefit).
      if (order) {
        await runPostOrderSideEffects(admin, order, correlationId);
      }
    } else if (event.event === 'payment.failed') {
      // Deliberately does NOT cancel the checkout session or release its
      // reserved inventory — a Razorpay order accepts multiple payment
      // attempts (wrong OTP, switched payment method, etc.), and a later
      // attempt on the *same* order can still succeed. Cancelling here
      // used to permanently lock the session out of checkout_complete
      // ("not payable, status cancelled") the moment the customer's next
      // attempt actually succeeded — the payment was captured by
      // Razorpay but no order was ever created. Genuinely abandoned
      // checkouts are already reclaimed by checkout_expire_stale_sessions
      // (0045) once the reservation window lapses, so nothing here needs
      // to eagerly free the reservation.
      logger.info('webhook.razorpay.payment_attempt_failed', {
        correlationId,
        razorpayOrderId: event.payload.payment?.entity.order_id,
      });
    }

    logger.info('webhook.razorpay.processed', { correlationId, event: event.event });
    return NextResponse.json({ received: true });
  } catch (cause) {
    logger.error('webhook.razorpay.unhandled_exception', {
      correlationId,
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
