import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPublicEnv, getServerEnv } from '@/config/env';
import { isEmailConfigured, sendEmail } from '@/server/email/resend-client';
import { buildOrderConfirmationEmailHtml } from '@/server/email/order-confirmation-email';
import { generateInvoicePdf } from '@/server/invoices/generate-invoice-pdf';
import { logger } from '@/server/logger';

interface OrderAddressSnapshot {
  recipientName?: string;
  formattedAddress?: string;
  flatNo?: string;
  phone?: string;
  email?: string;
}

interface OrderRow {
  id: string;
  order_number: string;
  created_at: string;
  order_snapshot: { address?: OrderAddressSnapshot } | null;
  subtotal: number;
  discount_total: number;
  delivery_fee: number;
  tax_total: number;
  grand_total: number;
  order_items: {
    product_id: string;
    product_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
}

const SETTINGS_KEYS = ['business_name', 'business_phone'] as const;

/**
 * Fires once, right after `checkout_complete` — sends the customer's
 * order confirmation (their first-ever email from this store; before
 * this function existed, none was sent at all) and a matching, richer
 * owner alert (item photos/names/total, not just a bare order number).
 * Regenerates the invoice PDF independently of `handleInvoiceGenerate`'s
 * own copy — cheap and dependency-free (pdf-lib, no external call), so
 * duplicating that one generation avoids threading raw PDF bytes across
 * two otherwise-independent functions.
 */
export async function sendOrderConfirmationEmails(
  admin: SupabaseClient,
  orderId: string,
): Promise<void> {
  if (!isEmailConfigured()) {
    logger.warn('order.confirmation_email.not_configured', { orderId });
    return;
  }

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select(
      'id, order_number, created_at, order_snapshot, subtotal, discount_total, delivery_fee, tax_total, grand_total, order_items(product_id, product_name, sku, quantity, unit_price, line_total)',
    )
    .eq('id', orderId)
    .single();
  if (orderError || !order) {
    logger.error('order.confirmation_email.order_not_found', {
      orderId,
      message: orderError?.message,
    });
    return;
  }
  const orderRow = order as unknown as OrderRow;
  const address = orderRow.order_snapshot?.address ?? {};

  const productIds = [...new Set(orderRow.order_items.map((item) => item.product_id))];
  const { data: products } = await admin
    .from('products')
    .select('id, featured_image')
    .in('id', productIds);
  const imageByProductId = new Map(
    (products ?? []).map((p) => [p.id, p.featured_image as string | null]),
  );

  const { data: settingsRows } = await admin
    .from('system_settings')
    .select('key, value')
    .in('key', SETTINGS_KEYS);
  const settings = new Map((settingsRows ?? []).map((row) => [row.key, row.value as unknown]));
  const businessName =
    typeof settings.get('business_name') === 'string'
      ? (settings.get('business_name') as string)
      : 'Fresh & Petals';
  const businessPhone =
    typeof settings.get('business_phone') === 'string'
      ? (settings.get('business_phone') as string)
      : null;

  const items = orderRow.order_items.map((item) => ({
    name: item.product_name,
    quantity: item.quantity,
    unitPrice: Number(item.unit_price),
    lineTotal: Number(item.line_total),
    imageUrl: imageByProductId.get(item.product_id) ?? null,
  }));

  let pdfAttachment: { filename: string; content: Buffer } | undefined;
  try {
    const pdfBytes = await generateInvoicePdf({
      invoiceNumber: orderRow.order_number,
      orderNumber: orderRow.order_number,
      issuedAt: new Date(orderRow.created_at),
      recipientName: address.recipientName ?? 'Customer',
      formattedAddress: address.formattedAddress ?? '',
      ...(address.flatNo ? { flatNo: address.flatNo } : {}),
      phone: address.phone ?? '',
      email: address.email ?? '',
      items: orderRow.order_items.map((item) => ({
        name: item.product_name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        lineTotal: Number(item.line_total),
      })),
      subtotal: Number(orderRow.subtotal),
      discountTotal: Number(orderRow.discount_total),
      deliveryFee: Number(orderRow.delivery_fee),
      taxTotal: Number(orderRow.tax_total),
      grandTotal: Number(orderRow.grand_total),
    });
    pdfAttachment = { filename: `${orderRow.order_number}.pdf`, content: Buffer.from(pdfBytes) };
  } catch (cause) {
    logger.error('order.confirmation_email.pdf_failed', {
      orderId,
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }

  const sharedParams = {
    orderNumber: orderRow.order_number,
    orderDate: new Date(orderRow.created_at),
    formattedAddress: address.formattedAddress ?? '',
    items,
    subtotal: Number(orderRow.subtotal),
    deliveryFee: Number(orderRow.delivery_fee),
    taxTotal: Number(orderRow.tax_total),
    discountTotal: Number(orderRow.discount_total),
    grandTotal: Number(orderRow.grand_total),
    businessName,
    businessPhone,
  };

  if (address.email) {
    try {
      await sendEmail({
        to: address.email,
        subject: `Order confirmed — ${orderRow.order_number}`,
        html: buildOrderConfirmationEmailHtml({
          ...sharedParams,
          recipient: 'customer',
          recipientName: address.recipientName ?? 'there',
        }),
        ...(pdfAttachment ? { attachments: [pdfAttachment] } : {}),
      });
    } catch (cause) {
      logger.error('order.confirmation_email.customer_send_failed', {
        orderId,
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  const env = getServerEnv();
  if (env.OWNER_NOTIFICATION_EMAIL) {
    try {
      const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
      await sendEmail({
        to: env.OWNER_NOTIFICATION_EMAIL,
        subject: `New order ${orderRow.order_number} — ₹${Number(orderRow.grand_total).toFixed(2)}`,
        html: buildOrderConfirmationEmailHtml({
          ...sharedParams,
          recipient: 'owner',
          recipientName: address.recipientName ?? 'Customer',
          adminOrderUrl: `${appUrl}/admin/orders/${orderId}`,
        }),
        ...(pdfAttachment ? { attachments: [pdfAttachment] } : {}),
      });
    } catch (cause) {
      logger.error('order.confirmation_email.owner_send_failed', {
        orderId,
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }
}
