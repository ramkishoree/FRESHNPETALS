import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateInvoicePdf } from './generate-invoice-pdf';

/**
 * Signed URLs are the correct choice for a bucket holding customer PII
 * (name/address/phone on every invoice) — but the account order page
 * reads `invoices.invoice_url` as a static, already-resolved link (see
 * app/(storefront)/account/orders/[id]/page.tsx), not something that
 * re-signs on every view. A long expiry is the pragmatic middle ground;
 * regenerating a fresh signed URL per view would be more correct but is a
 * bigger change than this job's scope.
 */
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 365 * 10;
const INVOICE_BUCKET = 'invoices';

interface OrderAddressSnapshot {
  recipientName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
}

interface OrderRow {
  id: string;
  order_number: string;
  order_snapshot: { address?: OrderAddressSnapshot } | null;
  subtotal: number;
  discount_total: number;
  delivery_fee: number;
  tax_total: number;
  grand_total: number;
  order_items: {
    product_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  gstin: string | null;
}

/**
 * Ch.8 §106 — generates the invoice PDF for a real, already-paid order and
 * stores a durable link back on the `invoices` row. `invoices.invoice_url`
 * has sat null since the schema was first written; this is the first code
 * that ever populates it. Requires a private `invoices` bucket to exist in
 * Supabase Storage (create it in the dashboard — same category of one-time
 * infra setup as the Resend domain or WhatsApp API keys, not something a
 * migration can provision).
 */
export async function handleInvoiceGenerate(
  admin: SupabaseClient,
  job: { payload: Record<string, unknown> },
): Promise<void> {
  const orderId = job.payload['orderId'];
  if (typeof orderId !== 'string' || !orderId) {
    throw new Error('invoice.generate job payload missing orderId');
  }

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select(
      'id, order_number, order_snapshot, subtotal, discount_total, delivery_fee, tax_total, grand_total, order_items(product_name, sku, quantity, unit_price, line_total)',
    )
    .eq('id', orderId)
    .single();
  if (orderError || !order) {
    throw new Error(`Order ${orderId} not found: ${orderError?.message ?? 'no row'}`);
  }
  const orderRow = order as unknown as OrderRow;

  const { data: invoice, error: invoiceError } = await admin
    .from('invoices')
    .select('id, invoice_number, gstin')
    .eq('order_id', orderId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (invoiceError || !invoice) {
    throw new Error(`Invoice for order ${orderId} not found: ${invoiceError?.message ?? 'no row'}`);
  }
  const invoiceRow = invoice as InvoiceRow;

  const address = orderRow.order_snapshot?.address ?? {};

  const pdfBytes = await generateInvoicePdf({
    invoiceNumber: invoiceRow.invoice_number,
    orderNumber: orderRow.order_number,
    issuedAt: new Date(),
    recipientName: address.recipientName ?? 'Customer',
    addressLine1: address.addressLine1 ?? '',
    ...(address.addressLine2 ? { addressLine2: address.addressLine2 } : {}),
    city: address.city ?? '',
    postalCode: address.postalCode ?? '',
    phone: address.phone ?? '',
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
    ...(invoiceRow.gstin ? { gstin: invoiceRow.gstin } : {}),
  });

  const storagePath = `${invoiceRow.invoice_number}.pdf`;
  const { error: uploadError } = await admin.storage
    .from(INVOICE_BUCKET)
    .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true });
  if (uploadError) {
    throw new Error(`Failed to upload invoice PDF: ${uploadError.message}`);
  }

  const { data: signedUrlData, error: signedUrlError } = await admin.storage
    .from(INVOICE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);
  if (signedUrlError || !signedUrlData) {
    throw new Error(`Failed to create signed URL: ${signedUrlError?.message ?? 'no data'}`);
  }

  const { error: updateError } = await admin
    .from('invoices')
    .update({ invoice_url: signedUrlData.signedUrl })
    .eq('id', invoiceRow.id);
  if (updateError) {
    throw new Error(`Failed to save invoice URL: ${updateError.message}`);
  }
}
