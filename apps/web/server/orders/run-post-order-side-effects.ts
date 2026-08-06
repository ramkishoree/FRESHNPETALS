import 'server-only';
import { processNextJob } from '@prana/operations';
import type { SupabaseClient } from '@supabase/supabase-js';
import { handleInvoiceGenerate } from '@/server/invoices/generate-invoice-job';
import { logger } from '@/server/logger';
import { sendOrderConfirmationEmails } from '@/server/orders/send-order-confirmation-emails';
import { SupabaseJobQueue } from '@/server/repositories/supabase-job-queue';
import { notifyOwnerOrderPlaced } from '@/server/support/notify-owner';

interface CompletedOrder {
  id: string;
  order_number: string;
  grand_total: number | string;
  currency: string;
  payment_method: string;
  order_snapshot: unknown;
}

/**
 * Everything that must happen once an order is real, regardless of how
 * it got there — the async Razorpay webhook (payment captured minutes
 * or hours after checkout) and the synchronous COD path (order
 * completes inside the same request that started checkout) both call
 * this exact function, so an order is never missing its WhatsApp alert,
 * invoice, or confirmation email just because it came from a different
 * payment method. Every side effect here is caught and logged, never
 * thrown — a notification/invoice failure must never undo an order
 * that's already real in the database.
 */
export async function runPostOrderSideEffects(
  admin: SupabaseClient,
  order: CompletedOrder,
  correlationId: string,
): Promise<void> {
  const snapshot = order.order_snapshot as {
    checkout?: { items?: { product_id: string; name: string; quantity: number }[] };
    address?: {
      recipientName?: string;
      phone?: string;
      flatNo?: string;
      formattedAddress?: string;
    };
    delivery?: { date?: string | null; slotLabel?: string | null };
  };
  const items = snapshot?.checkout?.items ?? [];
  const address = snapshot?.address;

  // Every item's photo, not just the first — the owner alert now sends
  // one message per item, so each needs its own image. One query for the
  // whole order rather than one per line.
  const productIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))];
  const imageByProductId = new Map<string, string | null>();
  if (productIds.length > 0) {
    const { data: products } = await admin
      .from('products')
      .select('id, featured_image')
      .in('id', productIds);
    for (const product of products ?? []) {
      imageByProductId.set(product.id as string, (product.featured_image as string | null) ?? null);
    }
  }

  await notifyOwnerOrderPlaced({
    orderNumber: order.order_number,
    grandTotal: Number(order.grand_total),
    currency: order.currency,
    paymentMethod: order.payment_method === 'cod' ? 'Cash on delivery' : 'Paid online',
    items: items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      imageUrl: imageByProductId.get(item.product_id) ?? null,
    })),
    customerName: address?.recipientName ?? 'Unknown customer',
    customerPhone: address?.phone ?? 'No phone on file',
    deliveryAddress:
      [address?.flatNo, address?.formattedAddress].filter(Boolean).join(', ') ||
      'No address on file',
    deliveryDate: snapshot?.delivery?.date ?? 'Not yet scheduled',
    deliveryTime: snapshot?.delivery?.slotLabel ?? 'Not yet scheduled',
  });

  // Queued (not just called directly) so a transient PDF/storage failure
  // gets the job queue's exponential-backoff retry via the next cron
  // sweep — but also attempted immediately right here so the customer
  // isn't left waiting on a once-daily cron for something this
  // time-sensitive.
  try {
    const jobQueue = new SupabaseJobQueue(admin);
    await jobQueue.enqueue('invoice.generate', { orderId: order.id });
    const workerId = `order-${correlationId.slice(0, 8)}`;
    await processNextJob(jobQueue, 'invoice.generate', workerId, (job) =>
      handleInvoiceGenerate(admin, job),
    );
  } catch (cause) {
    logger.error('order.side_effects.invoice_generate_failed', {
      correlationId,
      orderId: order.id,
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }

  try {
    await sendOrderConfirmationEmails(admin, order.id);
  } catch (cause) {
    logger.error('order.side_effects.confirmation_email_failed', {
      correlationId,
      orderId: order.id,
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }
}
