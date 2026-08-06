import 'server-only';
import { getServerEnv } from '@/config/env';
import { logger } from '@/server/logger';
import {
  isSupportedHeaderImageUrl,
  isWhatsAppConfigured,
  sendWhatsAppTemplate,
} from '@/server/whatsapp/meta-client';

export interface OrderAlertItem {
  name: string;
  quantity: number;
  /** Flower colour. The fastest way to tell two similarly-named
   *  arrangements apart while packing — see migration 0069. */
  color?: string | null;
}

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
 * Item lines are joined with " · " rather than newlines: Meta rejects
 * template parameters containing newline or tab characters, so a
 * multi-line list inside `{{2}}` would fail the send outright.
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

  const totalUnits = params.items.reduce((sum, item) => sum + item.quantity, 0);

  // "Dozen Red Roses (Red) ×2" — colour in brackets because the title
  // alone is ambiguous between similarly-named arrangements, which is
  // exactly the problem this is here to solve.
  const itemLines = params.items.map((item) => {
    const color = item.color?.trim();
    return `${item.name}${color ? ` (${color})` : ''} ×${item.quantity}`;
  });

  const itemsSummary =
    itemLines.length > 0
      ? `${params.items.length} product${params.items.length === 1 ? '' : 's'}, ${totalUnits} unit${totalUnits === 1 ? '' : 's'} — ${itemLines.join(' · ')}`
      : 'No items on file';

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
