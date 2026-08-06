import 'server-only';
import { getServerEnv } from '@/config/env';
import { logger } from '@/server/logger';
import { buildOrderItemsSummary, type OrderAlertItem } from '@/server/support/order-item-label';
import {
  isSupportedHeaderImageUrl,
  isWhatsAppConfigured,
  sendWhatsAppTemplate,
} from '@/server/whatsapp/meta-client';

/**
 * Owner's explicit call: every order gets one WhatsApp alert carrying
 * everything the order detail page shows — every item with its colour
 * and unit count, the customer, the delivery address, the slot, the
 * total and how it was paid — enough to act on without opening admin.
 *
 * **One message, one collage.** A template header holds exactly one
 * image and Meta has no multi-image template. Sending a message per item
 * was tried and rejected: it bills per item and buzzes the phone once
 * per product. `buildOrderCollage` tiles every photo into a single
 * header instead, so a three-product order is still one message.
 *
 * The item list itself is assembled by `buildOrderItemsSummary`, which
 * owns the two Meta constraints that bite here: no newlines in a
 * template parameter, and a 1024-character cap per parameter.
 *
 * Never blocks or fails the webhook that triggered it.
 */
export async function notifyOwnerOrderPlaced(params: {
  orderNumber: string;
  grandTotal: number;
  currency: string;
  items: OrderAlertItem[];
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  paymentMethod: string;
  deliveryDate: string;
  deliveryTime: string;
  /** Collage of every product photo, already composed and uploaded. */
  headerImageUrl?: string | null;
}): Promise<void> {
  const ownerWaId = getServerEnv().META_WHATSAPP_OWNER_WA_ID;

  if (!isWhatsAppConfigured() || !ownerWaId) {
    logger.warn('support.notify_owner.whatsapp_not_configured', {
      event: 'order_placed',
      orderNumber: params.orderNumber,
    });
    return;
  }

  const itemsSummary = buildOrderItemsSummary(params.items);

  const bodyParams = [
    params.orderNumber,
    itemsSummary,
    `${params.currency} ${params.grandTotal.toFixed(2)}`,
    params.customerName,
    params.customerPhone,
    params.deliveryAddress,
    params.paymentMethod,
    params.deliveryDate,
    params.deliveryTime,
  ];

  // The photo is a nice-to-have; the order details are not. Anything
  // Meta won't render as a header is dropped before the send rather than
  // allowed to take the whole alert down with it.
  const headerImageUrl =
    params.headerImageUrl && isSupportedHeaderImageUrl(params.headerImageUrl)
      ? params.headerImageUrl
      : null;

  if (params.headerImageUrl && !headerImageUrl) {
    logger.warn('support.notify_owner.header_image_unsupported', {
      event: 'order_placed',
      orderNumber: params.orderNumber,
      imageUrl: params.headerImageUrl,
    });
  }

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

    // Second chance without the picture: if Meta rejected the media
    // outright (a header the template doesn't declare, a link its
    // fetcher refuses at request time), the text-only alert still gets
    // through. This cannot rescue an unsupported *format* — Meta accepts
    // those synchronously and fails them later on the status webhook, so
    // nothing is ever thrown here. That case is prevented up front by
    // `isSupportedHeaderImageUrl`, not recovered from.
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
