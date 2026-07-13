import 'server-only';
import { getServerEnv } from '@/config/env';
import { logger } from '@/server/logger';
import { isWhatsAppConfigured, sendWhatsAppTemplate } from '@/server/whatsapp/meta-client';

/**
 * Owner's explicit call after removing the WhatsApp support bot: every
 * order still gets a WhatsApp alert to the owner with everything the
 * order detail page itself shows — items (plus the first item's photo
 * as the message's header image), customer name/phone, delivery
 * address, delivery date/time, and payment method — enough to act on
 * without opening the admin dashboard. Never blocks/fails the webhook
 * that triggered it; a WhatsApp send failure is logged, not thrown.
 *
 * Template `order_placed_alert_v3` must be submitted to Meta for
 * approval before this actually sends — see docs/whatsapp-support.md
 * for the exact text and placeholder order.
 */
export async function notifyOwnerOrderPlaced(params: {
  orderNumber: string;
  grandTotal: number;
  currency: string;
  itemsSummary: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  paymentMethod: string;
  deliveryDate: string;
  deliveryTime: string;
  /** First order item's product photo — Meta template header image
   *  requires a public HTTPS link, so this is skipped when null. */
  firstItemImageUrl: string | null;
}): Promise<void> {
  const env = getServerEnv();

  if (!isWhatsAppConfigured() || !env.META_WHATSAPP_OWNER_WA_ID) {
    logger.warn('support.notify_owner.whatsapp_not_configured', {
      event: 'order_placed',
      orderNumber: params.orderNumber,
    });
    return;
  }

  try {
    await sendWhatsAppTemplate({
      to: env.META_WHATSAPP_OWNER_WA_ID,
      templateName: 'order_placed_alert_v3',
      ...(params.firstItemImageUrl ? { headerImageUrl: params.firstItemImageUrl } : {}),
      bodyParams: [
        params.orderNumber,
        params.itemsSummary,
        `${params.currency} ${params.grandTotal.toFixed(2)}`,
        params.customerName,
        params.customerPhone,
        params.deliveryAddress,
        params.paymentMethod,
        params.deliveryDate,
        params.deliveryTime,
      ],
    });
  } catch (cause) {
    logger.error('support.notify_owner.whatsapp_failed', {
      event: 'order_placed',
      orderNumber: params.orderNumber,
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }
}
