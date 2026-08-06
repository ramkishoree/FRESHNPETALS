import { describe, expect, it } from 'vitest';
import { buildOrderConfirmationEmailHtml } from './order-confirmation-email';

function makeParams(
  overrides: Partial<Parameters<typeof buildOrderConfirmationEmailHtml>[0]> = {},
) {
  return {
    recipient: 'customer' as const,
    orderNumber: 'FNP-2026-000001',
    orderDate: new Date('2026-07-12T10:00:00Z'),
    recipientName: 'Priya Sharma',
    formattedAddress: '12 MG Road, Lucknow, Uttar Pradesh 226001',
    items: [
      {
        name: 'Rose Bouquet',
        quantity: 2,
        unitPrice: 999,
        lineTotal: 1998,
        imageUrl: 'https://example.com/rose.jpg',
      },
    ],
    subtotal: 1998,
    deliveryFee: 50,
    taxTotal: 99.9,
    discountTotal: 0,
    grandTotal: 2147.9,
    businessName: 'Fresh & Petals',
    businessPhone: '9876543210',
    ...overrides,
  };
}

describe('buildOrderConfirmationEmailHtml', () => {
  it('renders order number, item names, and grand total — never fabricated', () => {
    const html = buildOrderConfirmationEmailHtml(makeParams());
    expect(html).toContain('FNP-2026-000001');
    expect(html).toContain('Rose Bouquet');
    expect(html).toContain('₹2147.90');
    expect(html).toContain('9876543210');
  });

  it('shows the customer greeting and invoice-attached line for recipient=customer', () => {
    const html = buildOrderConfirmationEmailHtml(makeParams({ recipient: 'customer' }));
    expect(html).toContain('Thank you, Priya Sharma');
    expect(html).toContain('invoice is attached');
  });

  it('shows the admin deep-link only for recipient=owner, never the customer', () => {
    const html = buildOrderConfirmationEmailHtml(
      makeParams({ recipient: 'owner', adminOrderUrl: 'https://freshnpetals.in/admin/orders/abc' }),
    );
    expect(html).toContain('Open this order in the admin panel');
    expect(html).toContain('https://freshnpetals.in/admin/orders/abc');

    const customerHtml = buildOrderConfirmationEmailHtml(makeParams({ recipient: 'customer' }));
    expect(customerHtml).not.toContain('Open this order in the admin panel');
  });

  it('escapes item names so a stray "<" in a product name cannot break the markup', () => {
    const html = buildOrderConfirmationEmailHtml(
      makeParams({
        items: [
          {
            name: '<script>evil</script>',
            quantity: 1,
            unitPrice: 1,
            lineTotal: 1,
            imageUrl: null,
          },
        ],
      }),
    );
    expect(html).not.toContain('<script>evil</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('omits the discount row entirely when there is no discount', () => {
    const html = buildOrderConfirmationEmailHtml(makeParams({ discountTotal: 0 }));
    expect(html).not.toContain('Discount');
  });
});

describe('multi-item orders', () => {
  const threeItems = [
    {
      name: 'Rose Bouquet',
      quantity: 2,
      unitPrice: 999,
      lineTotal: 1998,
      imageUrl: 'https://cdn/rose.jpg',
    },
    {
      name: 'Lily Box',
      quantity: 1,
      unitPrice: 750,
      lineTotal: 750,
      imageUrl: 'https://cdn/lily.jpg',
    },
    { name: 'Orchid Vase', quantity: 3, unitPrice: 500, lineTotal: 1500, imageUrl: null },
  ];

  it('renders every line, not just the first', () => {
    const html = buildOrderConfirmationEmailHtml(makeParams({ items: threeItems }));

    for (const item of threeItems) {
      expect(html).toContain(item.name);
    }
  });

  it('gives each item its own photo rather than reusing one', () => {
    const html = buildOrderConfirmationEmailHtml(makeParams({ items: threeItems }));

    expect(html).toContain('https://cdn/rose.jpg');
    expect(html).toContain('https://cdn/lily.jpg');
    // The third has no photo — it must simply render no <img>, not a
    // broken one, and certainly not another item's picture.
    expect(html.match(/<img/g) ?? []).toHaveLength(2);
  });

  it('labels each photo with its product, so a client that blocks images still reads', () => {
    // alt="" was the old value: with images blocked (Outlook's default)
    // the order became a list of empty boxes.
    const html = buildOrderConfirmationEmailHtml(makeParams({ items: threeItems }));

    expect(html).toContain('alt="Rose Bouquet"');
    expect(html).toContain('alt="Lily Box"');
  });

  it('states the item count, distinguishing products from units', () => {
    const html = buildOrderConfirmationEmailHtml(makeParams({ items: threeItems }));

    expect(html).toContain('3 products · 6 items');
  });

  it('says plain "items" when every product is a single unit', () => {
    const html = buildOrderConfirmationEmailHtml(
      makeParams({
        items: threeItems.map((item) => ({ ...item, quantity: 1 })),
      }),
    );

    expect(html).toContain('3 items');
    expect(html).not.toContain('products ·');
  });
});
