import 'server-only';
import { processNextJob } from '@prana/operations';
import type { SupabaseClient } from '@supabase/supabase-js';
import { handleInvoiceGenerate } from '@/server/invoices/generate-invoice-job';
import { logger } from '@/server/logger';
import { sendOrderConfirmationEmails } from '@/server/orders/send-order-confirmation-emails';
import { SupabaseJobQueue } from '@/server/repositories/supabase-job-queue';
import { notifyOwnerOrderPlaced } from '@/server/support/notify-owner';
import { buildOrderCollage } from '@/server/whatsapp/order-collage';

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

  // Every product's photo and colour in one query. The photos become a
  // single collage for the alert header; the colours disambiguate items
  // whose titles look alike at a glance.
  const productIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))];
  const productById = new Map<
    string,
    {
      image: string | null;
      color: string | null;
      flowerType: string | null;
      sizeLabel: string | null;
      packaging: string | null;
      ownerNote: string | null;
    }
  >();
  if (productIds.length > 0) {
    const { data: products } = await admin
      .from('products')
      // The packing columns are selected *here and in the admin editor
      // only* — they are owner-only and must never reach a storefront
      // query, which is why they are absent from PRODUCT_SELECT_COLUMNS
      // and from the Product domain type.
      .select('id, featured_image, color, flower_type, size_label, packaging, owner_note')
      .in('id', productIds);
    for (const product of products ?? []) {
      productById.set(product.id as string, {
        image: (product.featured_image as string | null) ?? null,
        color: (product.color as string | null) ?? null,
        flowerType: (product.flower_type as string | null) ?? null,
        sizeLabel: (product.size_label as string | null) ?? null,
        packaging: (product.packaging as string | null) ?? null,
        ownerNote: (product.owner_note as string | null) ?? null,
      });
    }
  }

  // Photos are stored as WebP, which Meta won't render — the collage is
  // re-encoded as JPEG, so it sidesteps that entirely.
  const collageUrl = await buildOrderCollage({
    admin,
    orderNumber: order.order_number,
    imageUrls: items
      .map((item) => productById.get(item.product_id)?.image)
      .filter((url): url is string => Boolean(url)),
  });

  await notifyOwnerOrderPlaced({
    orderNumber: order.order_number,
    grandTotal: Number(order.grand_total),
    currency: order.currency,
    paymentMethod: order.payment_method === 'cod' ? 'Cash on delivery' : 'Paid online',
    items: items.map((item) => {
      const product = productById.get(item.product_id);
      return {
        name: item.name,
        quantity: item.quantity,
        color: product?.color ?? null,
        flowerType: product?.flowerType ?? null,
        sizeLabel: product?.sizeLabel ?? null,
        packaging: product?.packaging ?? null,
        ownerNote: product?.ownerNote ?? null,
      };
    }),
    headerImageUrl: collageUrl,
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
