import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPublicEnv } from '@/config/env';
import { isEmailConfigured, sendEmail } from '@/server/email/resend-client';
import { logger } from '@/server/logger';

const WINDOW_START_HOURS = 48;
const WINDOW_END_HOURS = 24;
const NUDGE_EVENT_TYPE = 'review.nudge_sent';

interface DeliveryRow {
  order_id: string;
  orders: {
    id: string;
    order_number: string;
    customer_id: string;
    order_items: { product_name: string }[];
    customers: { email: string | null; first_name: string | null } | null;
  } | null;
}

/**
 * Ch.9 §115-ish (review moderation lives around here) — no automated
 * post-delivery review request existed anywhere. A real, dedicated
 * dispatch: orders delivered 24-48h ago that haven't already been
 * nudged (tracked via `order_events`, reusing the existing audit-trail
 * table rather than adding a new column just for a boolean flag).
 *
 * Email-only for now — a WhatsApp version would need its own Meta
 * template submitted for approval first (same requirement as the
 * order-placed/escalation templates already documented in
 * docs/whatsapp-support.md); not worth blocking this on that.
 */
export async function sweepReviewRequestNudges(admin: SupabaseClient): Promise<void> {
  if (!isEmailConfigured()) {
    logger.warn('worker.review_nudge.email_not_configured');
    return;
  }

  const now = Date.now();
  const windowStart = new Date(now - WINDOW_START_HOURS * 3600 * 1000).toISOString();
  const windowEnd = new Date(now - WINDOW_END_HOURS * 3600 * 1000).toISOString();

  const { data, error } = await admin
    .from('deliveries')
    .select(
      'order_id, orders(id, order_number, customer_id, order_items(product_name), customers(email, first_name))',
    )
    .eq('status', 'delivered')
    .gte('actual_delivery', windowStart)
    .lte('actual_delivery', windowEnd);

  if (error) {
    logger.error('worker.review_nudge.query_failed', { message: error.message });
    return;
  }

  const deliveries = (data ?? []) as unknown as DeliveryRow[];
  let sentCount = 0;

  for (const delivery of deliveries) {
    const order = delivery.orders;
    if (!order?.customers?.email) continue;

    const { data: existingEvent } = await admin
      .from('order_events')
      .select('id')
      .eq('order_id', order.id)
      .eq('event_type', NUDGE_EVENT_TYPE)
      .maybeSingle();
    if (existingEvent) continue;

    const productNames = order.order_items.map((i) => i.product_name).join(', ');
    const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
    const orderUrl = `${appUrl}/account/orders/${order.id}`;
    const greetingName = order.customers.first_name ? `, ${order.customers.first_name}` : '';

    try {
      await sendEmail({
        to: order.customers.email,
        subject: `How was your order, ${order.order_number}?`,
        html:
          `<p>Hi${greetingName},</p>` +
          `<p>We hope you loved your ${productNames} from Fresh N Petals! ` +
          `Would you take a moment to leave a review?</p>` +
          `<p><a href="${orderUrl}">Leave a review</a></p>` +
          `<p>Thank you for shopping with us.</p>`,
      });
      await admin.from('order_events').insert({
        order_id: order.id,
        event_type: NUDGE_EVENT_TYPE,
        source: 'system',
      });
      sentCount += 1;
    } catch (cause) {
      logger.error('worker.review_nudge.send_failed', {
        orderId: order.id,
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  logger.info('worker.review_nudge.completed', { sentCount, candidateCount: deliveries.length });
}
