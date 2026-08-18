// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mapProductRow } from './shop-query';

type Row = Parameters<typeof mapProductRow>[0];

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 'p1',
    sku: 'SKU-1',
    slug: 'rose',
    name: 'Rose',
    short_description: null,
    color: null,
    type: null,
    featured_image: null,
    status: 'published',
    created_at: '2026-01-01T00:00:00Z',
    product_prices: { base_price: 999, sale_price: null },
    inventory: [],
    product_media: [],
    reviews: [],
    ...overrides,
  } as Row;
}

describe('mapProductRow — review aggregation', () => {
  it('averages approved reviews', () => {
    const product = makeRow({
      reviews: [
        { rating: 5, status: 'approved', deleted_at: null },
        { rating: 3, status: 'approved', deleted_at: null },
      ],
    });

    expect(mapProductRow(product).averageRating).toBe(4);
    expect(mapProductRow(product).approvedReviewCount).toBe(2);
  });

  it('ignores a review the owner removed', () => {
    // The bug this pins: a removed review kept counting toward the
    // rating an owner saw, because RLS hides deleted rows from
    // customers but the permissive admin policy does not.
    const product = makeRow({
      reviews: [
        { rating: 5, status: 'approved', deleted_at: null },
        { rating: 1, status: 'approved', deleted_at: '2026-08-16T00:00:00Z' },
      ],
    });

    expect(mapProductRow(product).averageRating).toBe(5);
    expect(mapProductRow(product).approvedReviewCount).toBe(1);
  });

  it('ignores reviews that are not approved', () => {
    const product = makeRow({
      reviews: [
        { rating: 5, status: 'approved', deleted_at: null },
        { rating: 1, status: 'pending', deleted_at: null },
        { rating: 1, status: 'rejected', deleted_at: null },
      ],
    });

    expect(mapProductRow(product).averageRating).toBe(5);
    expect(mapProductRow(product).approvedReviewCount).toBe(1);
  });

  it('reports no rating rather than zero when every review is gone', () => {
    // Zero would render as an honest-looking 0-star product.
    const product = makeRow({
      reviews: [{ rating: 5, status: 'approved', deleted_at: '2026-08-16T00:00:00Z' }],
    });

    expect(mapProductRow(product).averageRating).toBeNull();
    expect(mapProductRow(product).approvedReviewCount).toBe(0);
  });
});

describe('mapProductRow — product type', () => {
  it('carries the free-text type through to the card', () => {
    expect(mapProductRow(makeRow({ type: 'Bouquet' })).type).toBe('Bouquet');
  });

  it('reads a missing type as null rather than undefined', () => {
    // The card renders on `product.type &&`, and an undefined here would
    // still be falsy — but `Product` declares `string | null`, and a row
    // fetched before migration 0078 backfills simply has no key at all.
    const row = makeRow();
    delete (row as { type?: unknown }).type;

    expect(mapProductRow(row).type).toBeNull();
  });
});
