import 'server-only';
import { getServerEnv } from '@/config/env';
import { logger } from '@/server/logger';
import { jpegSiblingUrl } from '@/server/media/jpeg-sibling';
import {
  isSupportedHeaderImageUrl,
  isWhatsAppConfigured,
  sendWhatsAppTemplate,
} from '@/server/whatsapp/meta-client';

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
  const ownerWaId = getServerEnv().META_WHATSAPP_OWNER_WA_ID;

  if (!isWhatsAppConfigured() || !ownerWaId) {
    logger.warn('support.notify_owner.whatsapp_not_configured', {
      event: 'order_placed',
      orderNumber: params.orderNumber,
    });
    return;
  }

  const bodyParams = [
    params.orderNumber,
    params.itemsSummary,
    `${params.currency} ${params.grandTotal.toFixed(2)}`,
    params.customerName,
    params.customerPhone,
    params.deliveryAddress,
    params.paymentMethod,
    params.deliveryDate,
    params.deliveryTime,
  ];

  // The photo is a nice-to-have; the order details are not. Product
  // images are stored as WebP, which Meta refuses, so aim at the JPEG
  // sibling uploaded next to it — and drop the header entirely if what's
  // left still isn't something Meta will render, rather than let it take
  // the whole alert down.
  const candidateImageUrl = params.firstItemImageUrl
    ? (jpegSiblingUrl(params.firstItemImageUrl) ?? params.firstItemImageUrl)
    : null;
  const headerImageUrl =
    candidateImageUrl && isSupportedHeaderImageUrl(candidateImageUrl) ? candidateImageUrl : null;

  if (params.firstItemImageUrl && !headerImageUrl) {
    logger.warn('support.notify_owner.header_image_unsupported', {
      event: 'order_placed',
      orderNumber: params.orderNumber,
      imageUrl: params.firstItemImageUrl,
    });
  }

  // An arrow bound after the guard above, not a hoisted declaration —
  // that's what lets TypeScript carry the `ownerWaId` narrowing inside.
  const send = async (withHeader: boolean): Promise<void> => {
    await sendWhatsAppTemplate({
      to: ownerWaId,
      templateName: 'order_placed_alert_v3',
      ...(withHeader && headerImageUrl ? { headerImageUrl } : {}),
      bodyParams,
    });
  };

  try {
    await send(true);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);

    // Second chance without the picture: if Meta rejected the media (a
    // dead link, an image it can't fetch, a header the template doesn't
    // declare), the text-only alert still gets through.
    if (headerImageUrl) {
      logger.warn('support.notify_owner.whatsapp_retrying_without_header', {
        event: 'order_placed',
        orderNumber: params.orderNumber,
        message,
      });
      try {
        await send(false);
        return;
      } catch (retryCause) {
        logger.error('support.notify_owner.whatsapp_failed', {
          event: 'order_placed',
          orderNumber: params.orderNumber,
          message: retryCause instanceof Error ? retryCause.message : String(retryCause),
        });
        return;
      }
    }

    logger.error('support.notify_owner.whatsapp_failed', {
      event: 'order_placed',
      orderNumber: params.orderNumber,
      message,
    });
  }
}
