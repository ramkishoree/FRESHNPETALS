import 'server-only';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface InvoiceLineItem {
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoicePdfInput {
  invoiceNumber: string;
  orderNumber: string;
  issuedAt: Date;
  recipientName: string;
  /** Reverse-geocoded text for the mandatory delivery pin — the address
   * is a map location now, not separately typed street/city/postal
   * fields (Ch.8 §88's checkout simplification). */
  formattedAddress: string;
  flatNo?: string;
  phone: string;
  email: string;
  items: InvoiceLineItem[];
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  taxTotal: number;
  grandTotal: number;
  gstin?: string;
}

const PAGE_WIDTH = 595.28; // A4 at 72dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

function formatInr(amount: number): string {
  return `Rs. ${amount.toFixed(2)}`;
}

/**
 * Ch.8 §106 Invoice generation — `invoices.invoice_url` has existed since
 * the schema was first written, but nothing ever populated it (no PDF
 * library, no generation code, anywhere). This produces a real invoice
 * from actual order data — no placeholder line items, no fabricated
 * totals — using pdf-lib (pure JS, no native deps, fine on Vercel's
 * serverless runtime).
 */
export async function generateInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.15, 0.19, 0.17);
  const muted = rgb(0.42, 0.4, 0.35);
  const green = rgb(0.18, 0.29, 0.23);

  let y = PAGE_HEIGHT - MARGIN;

  page.drawText('Fresh & Petals', { x: MARGIN, y, size: 20, font: bold, color: green });
  page.drawText('TAX INVOICE', {
    x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize('TAX INVOICE', 11),
    y: y + 3,
    size: 11,
    font: bold,
    color: muted,
  });
  y -= 30;

  const meta: [string, string][] = [
    ['Invoice #', input.invoiceNumber],
    ['Order #', input.orderNumber],
    ['Date', input.issuedAt.toLocaleDateString('en-IN', { dateStyle: 'medium' })],
    ...(input.gstin ? ([['GSTIN', input.gstin]] as [string, string][]) : []),
  ];
  for (const [label, value] of meta) {
    page.drawText(`${label}:`, { x: MARGIN, y, size: 10, font: regular, color: muted });
    page.drawText(value, { x: MARGIN + 70, y, size: 10, font: regular, color: ink });
    y -= 16;
  }

  y -= 10;
  page.drawText('Deliver to', { x: MARGIN, y, size: 10, font: bold, color: muted });
  y -= 16;
  const addressLines = [
    input.recipientName,
    ...(input.flatNo ? [input.flatNo] : []),
    input.formattedAddress,
    input.phone,
    input.email,
  ];
  for (const line of addressLines) {
    page.drawText(line, { x: MARGIN, y, size: 10, font: regular, color: ink });
    y -= 14;
  }

  y -= 20;
  const colItem = MARGIN;
  const colQty = PAGE_WIDTH - MARGIN - 220;
  const colPrice = PAGE_WIDTH - MARGIN - 150;
  const colTotal = PAGE_WIDTH - MARGIN - 70;

  page.drawLine({
    start: { x: MARGIN, y: y + 12 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + 12 },
    thickness: 1,
    color: rgb(0.85, 0.8, 0.65),
  });
  page.drawText('Item', { x: colItem, y, size: 10, font: bold, color: muted });
  page.drawText('Qty', { x: colQty, y, size: 10, font: bold, color: muted });
  page.drawText('Price', { x: colPrice, y, size: 10, font: bold, color: muted });
  page.drawText('Total', { x: colTotal, y, size: 10, font: bold, color: muted });
  y -= 18;

  for (const item of input.items) {
    page.drawText(item.name, { x: colItem, y, size: 10, font: regular, color: ink });
    page.drawText(String(item.quantity), { x: colQty, y, size: 10, font: regular, color: ink });
    page.drawText(formatInr(item.unitPrice), {
      x: colPrice,
      y,
      size: 10,
      font: regular,
      color: ink,
    });
    page.drawText(formatInr(item.lineTotal), {
      x: colTotal,
      y,
      size: 10,
      font: regular,
      color: ink,
    });
    y -= 16;
  }

  y -= 10;
  page.drawLine({
    start: { x: MARGIN, y: y + 12 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + 12 },
    thickness: 1,
    color: rgb(0.85, 0.8, 0.65),
  });

  const totals: [string, number, boolean][] = [
    ['Subtotal', input.subtotal, false],
    ...(input.discountTotal > 0
      ? ([['Discount', -input.discountTotal, false]] as [string, number, boolean][])
      : []),
    ['Delivery fee', input.deliveryFee, false],
    ['GST (5%)', input.taxTotal, false],
    ['Grand total', input.grandTotal, true],
  ];
  for (const [label, amount, emphasize] of totals) {
    const font = emphasize ? bold : regular;
    const size = emphasize ? 12 : 10;
    page.drawText(label, { x: colPrice - 40, y, size, font, color: emphasize ? green : muted });
    const text = formatInr(amount);
    page.drawText(text, {
      x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(text, size),
      y,
      size,
      font,
      color: emphasize ? green : ink,
    });
    y -= emphasize ? 20 : 16;
  }

  page.drawText('Thank you for shopping with Fresh & Petals.', {
    x: MARGIN,
    y: MARGIN,
    size: 9,
    font: regular,
    color: muted,
  });

  return doc.save();
}
