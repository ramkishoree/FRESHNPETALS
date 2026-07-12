import { processNextJob } from '@prana/operations';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { handleInvoiceGenerate } from '@/server/invoices/generate-invoice-job';
import { logger } from '@/server/logger';
import { sendOrderConfirmationEmails } from '@/server/orders/send-order-confirmation-emails';
import { verifyWebhookSignature } from '@/server/payments/razorpay-adapter';
import { SupabaseJobQueue } from '@/server/repositories/supabase-job-queue';
import { notifyOwnerOrderPlaced } from '@/server/support/notify-owner';

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

      // Order-placed owner alert. Awaited (not fire-and-forget) — a
      // serverless function can be frozen the instant it returns a
      // response, which would kill an in-flight unawaited promise before
      // the notification actually sends. notifyOwnerOrderPlaced already
      // catches per-channel failures internally, so awaiting it here
      // can't turn a notification failure into a webhook failure.
      if (order) {
        await notifyOwnerOrderPlaced({
          orderNumber: order.order_number,
          grandTotal: Number(order.grand_total),
          currency: order.currency,
        });

        // Queued (not just called directly) so a transient PDF/storage
        // failure gets the job queue's exponential-backoff retry via the
        // next cron sweep — but also attempted immediately right here so
        // the customer isn't left waiting on a once-daily cron for
        // something this time-sensitive. Failure here is caught and
        // logged, never allowed to fail the webhook itself (Razorpay would
        // just retry the whole webhook, re-triggering checkout_complete's
        // idempotency path for no benefit).
        try {
          const jobQueue = new SupabaseJobQueue(admin);
          await jobQueue.enqueue('invoice.generate', { orderId: order.id });
          const workerId = `webhook-${correlationId.slice(0, 8)}`;
          await processNextJob(jobQueue, 'invoice.generate', workerId, (job) =>
            handleInvoiceGenerate(admin, job),
          );
        } catch (cause) {
          logger.error('webhook.razorpay.invoice_generate_failed', {
            correlationId,
            message: cause instanceof Error ? cause.message : String(cause),
          });
        }

        // Customer's first-ever order email, plus the richer owner alert
        // (item photos/names/invoice PDF attached) that supersedes
        // notifyOwnerOrderPlaced's bare-bones one above. Its own failures
        // are caught internally per-recipient — never allowed to fail the
        // webhook itself, same discipline as the invoice job above.
        try {
          await sendOrderConfirmationEmails(admin, order.id);
        } catch (cause) {
          logger.error('webhook.razorpay.confirmation_email_failed', {
            correlationId,
            message: cause instanceof Error ? cause.message : String(cause),
          });
        }
      }
    } else if (event.event === 'payment.failed') {
      const payment = event.payload.payment?.entity;
      if (payment) {
        const { data: session } = await admin
          .from('checkout_sessions')
          .select('id')
          .eq('metadata->>razorpayOrderId', payment.order_id)
          .maybeSingle();
        if (session) {
          await admin.rpc('checkout_cancel', {
            p_checkout_session_id: session.id,
            p_new_status: 'cancelled',
          });
        }
      }
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
