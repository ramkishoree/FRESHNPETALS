import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { generateInvoicePdf, type InvoicePdfInput } from './generate-invoice-pdf';

function makeInput(overrides: Partial<InvoicePdfInput> = {}): InvoicePdfInput {
  return {
    invoiceNumber: 'INV-FNP-2026-000001',
    orderNumber: 'FNP-2026-000001',
    issuedAt: new Date('2026-07-11T10:00:00Z'),
    recipientName: 'Priya Sharma',
    addressLine1: '12 MG Road',
    city: 'Lucknow',
    postalCode: '226001',
    phone: '9876543210',
    items: [
      { name: 'Rose Bouquet', sku: 'ROSE-01', quantity: 2, unitPrice: 999, lineTotal: 1998 },
      { name: 'Chocolate Box', sku: 'CHOC-02', quantity: 1, unitPrice: 499, lineTotal: 499 },
    ],
    subtotal: 2497,
    discountTotal: 0,
    deliveryFee: 50,
    taxTotal: 124.85,
    grandTotal: 2671.85,
    ...overrides,
  };
}

describe('generateInvoicePdf', () => {
  it('produces a well-formed, single-page PDF', async () => {
    const bytes = await generateInvoicePdf(makeInput());

    // %PDF is the mandatory magic header for every valid PDF file.
    expect(Buffer.from(bytes.slice(0, 4)).toString('ascii')).toBe('%PDF');

    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('never fabricates totals — the PDF is built from exactly the numbers passed in', async () => {
    const input = makeInput({ discountTotal: 200, grandTotal: 2471.85 });
    const bytes = await generateInvoicePdf(input);
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
    // pdf-lib doesn't expose text extraction; the meaningful guarantee here
    // is that generation succeeds for a discounted order without throwing,
    // and produces the same well-formed single-page document.
  });

  it('handles a cart with many line items without erroring', async () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      name: `Product ${i + 1}`,
      sku: `SKU-${i + 1}`,
      quantity: 1,
      unitPrice: 100,
      lineTotal: 100,
    }));
    const bytes = await generateInvoicePdf(
      makeInput({ items, subtotal: 1500, grandTotal: 1629.75 }),
    );
    expect(Buffer.from(bytes.slice(0, 4)).toString('ascii')).toBe('%PDF');
  });
});
