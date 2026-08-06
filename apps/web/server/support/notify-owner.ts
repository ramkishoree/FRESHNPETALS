import 'server-only';
import { getServerEnv } from '@/config/env';
import { logger } from '@/server/logger';
import { jpegSiblingUrl } from '@/server/media/jpeg-sibling';
import {
  isSupportedHeaderImageUrl,
  isWhatsAppConfigured,
  sendWhatsAppTemplate,
} from '@/server/whatsapp/meta-client';

export interface OrderAlertItem {
  name: string;
  quantity: number;
  /** The product photo. Stored as WebP, so it is swapped for the JPEG
   *  sibling before Meta ever sees it. */
  imageUrl: string | null;
}

/**
 * Owner's explicit call: every order gets a WhatsApp alert with
 * everything the order detail page shows — items, customer name/phone,
 * delivery address, date/time, and payment method — enough to act on
 * without opening the admin dashboard.
 *
 * **One message per item**, by the owner's decision. A WhatsApp template
 * header holds exactly one image and Meta has no multi-image template,
 * so a three-item order sends three messages, each carrying that item's
 * own photo alongside the full order context. That is three Meta charges
 * and three phone buzzes per order — deliberately accepted in exchange
 * for seeing every product. See docs/whatsapp-support.md.
 *
 * Never blocks or fails the webhook that triggered it, and each message
 * is sent and caught independently: one item failing must not silence
 * the rest of the order.
 *
 * Template `order_placed_alert_v3` must be approved by Meta before this
 * sends anything.
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
}): Promise<void> {
  const ownerWaId = getServerEnv().META_WHATSAPP_OWNER_WA_ID;

  if (!isWhatsAppConfigured() || !ownerWaId) {
    logger.warn('support.notify_owner.whatsapp_not_configured', {
      event: 'order_placed',
      orderNumber: params.orderNumber,
    });
    return;
  }

  // An order with no line items still has to reach the owner — falling
  // back to one message keeps a malformed order visible instead of
  // silently sending nothing at all.
  const items: OrderAlertItem[] =
    params.items.length > 0
      ? params.items
      : [{ name: 'No items on file', quantity: 1, imageUrl: null }];

  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  for (const [index, item] of items.entries()) {
    // `{{2}}` is the items slot in the approved template. With one
    // message per item it carries that item plus its position, so the
    // owner can tell "1 of 3" from a single glance and knows how many
    // more are coming.
    const itemLabel =
      items.length > 1
        ? `${item.name} ×${item.quantity}  (item ${index + 1} of ${items.length}, ${totalUnits} units total)`
        : `${item.name} ×${item.quantity}`;

    const bodyParams = [
      params.orderNumber,
      itemLabel,
      `${params.currency} ${params.grandTotal.toFixed(2)}`,
      params.customerName,
      params.customerPhone,
      params.deliveryAddress,
      params.paymentMethod,
      params.deliveryDate,
      params.deliveryTime,
    ];

    // The photo is a nice-to-have; the order details are not. Anything
    // Meta won't render as a header is dropped before the send rather
    // than allowed to take the message down with it.
    const candidateImageUrl = item.imageUrl
      ? (jpegSiblingUrl(item.imageUrl) ?? item.imageUrl)
      : null;
    const headerImageUrl =
      candidateImageUrl && isSupportedHeaderImageUrl(candidateImageUrl) ? candidateImageUrl : null;

    if (item.imageUrl && !headerImageUrl) {
      logger.warn('support.notify_owner.header_image_unsupported', {
        event: 'order_placed',
        orderNumber: params.orderNumber,
        imageUrl: item.imageUrl,
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
      // through. This cannot rescue an unsupported *format* — Meta
      // accepts those synchronously and fails them later on the status
      // webhook, so nothing is ever thrown here. That case is prevented
      // up front by `isSupportedHeaderImageUrl`, not recovered from.
      if (headerImageUrl) {
        logger.warn('support.notify_owner.whatsapp_retrying_without_header', {
          event: 'order_placed',
          orderNumber: params.orderNumber,
          message,
        });
        try {
          await send(false);
          continue;
        } catch (retryCause) {
          logger.error('support.notify_owner.whatsapp_failed', {
            event: 'order_placed',
            orderNumber: params.orderNumber,
            itemName: item.name,
            message: retryCause instanceof Error ? retryCause.message : String(retryCause),
          });
          continue;
        }
      }

      logger.error('support.notify_owner.whatsapp_failed', {
        event: 'order_placed',
        orderNumber: params.orderNumber,
        itemName: item.name,
        message,
      });
    }
  }
}
