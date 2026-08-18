// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { interleaveByCategory, mapProductRow, sortProducts } from './shop-query';

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
    category_id: null,
    categories: null,
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

function product(
  id: string,
  categoryId: string | null,
  categorySortOrder: number | null,
  price = 100,
) {
  return {
    ...mapProductRow(
      makeRow({
        id,
        category_id: categoryId,
        categories: categorySortOrder === null ? null : { sort_order: categorySortOrder },
        product_prices: { base_price: price, sale_price: null },
      }),
    ),
  };
}

const ids = (list: ReturnType<typeof product>[]) => list.map((item) => item.id).join(' ');

describe('interleaveByCategory', () => {
  it('deals one product from each category in turn', () => {
    // The owner's reason for this existing: sorted by date the whole
    // first screen could be six bunch bouquets, and someone after a
    // plant would decide the shop has none.
    const result = interleaveByCategory([
      product('bouquet-1', 'bouquet', 1),
      product('bouquet-2', 'bouquet', 1),
      product('plant-1', 'plant', 2),
      product('plant-2', 'plant', 2),
    ]);

    expect(ids(result)).toBe('bouquet-1 plant-1 bouquet-2 plant-2');
  });

  it('visits categories in their admin sort_order, not the fetch order', () => {
    const result = interleaveByCategory([
      product('late-1', 'late', 9),
      product('early-1', 'early', 1),
    ]);

    expect(ids(result)).toBe('early-1 late-1');
  });

  it('treats sort_order 0 as first, not as missing', () => {
    // `?? Infinity` rather than `|| Infinity`: 0 is a real position and
    // `||` would have flung the first category to the very end.
    const result = interleaveByCategory([product('b', 'b', 5), product('a', 'a', 0)]);

    expect(ids(result)).toBe('a b');
  });

  it('closes the rotation up when a category runs out', () => {
    // An uneven catalogue is the normal case — twenty bouquets and two
    // plants must not leave holes once the plants are exhausted.
    const result = interleaveByCategory([
      product('b1', 'bouquet', 1),
      product('b2', 'bouquet', 1),
      product('b3', 'bouquet', 1),
      product('p1', 'plant', 2),
    ]);

    expect(ids(result)).toBe('b1 p1 b2 b3');
  });

  it('puts uncategorised products last rather than dropping them', () => {
    const result = interleaveByCategory([
      product('loose', null, null),
      product('filed', 'bouquet', 1),
    ]);

    expect(ids(result)).toBe('filed loose');
  });

  it('keeps every product exactly once', () => {
    const input = [
      product('a1', 'a', 1),
      product('b1', 'b', 2),
      product('b2', 'b', 2),
      product('c1', 'c', 3),
    ];

    expect(interleaveByCategory(input)).toHaveLength(input.length);
    expect(new Set(interleaveByCategory(input).map((p) => p.id)).size).toBe(input.length);
  });
});

describe('sortProducts', () => {
  const catalogue = [
    product('b1', 'bouquet', 1, 500),
    product('b2', 'bouquet', 1, 100),
    product('p1', 'plant', 2, 300),
  ];

  it('interleaves when no sort is asked for', () => {
    expect(ids(sortProducts(catalogue))).toBe('b1 p1 b2');
  });

  it('leaves the database order alone for newest', () => {
    expect(ids(sortProducts(catalogue, 'newest'))).toBe('b1 b2 p1');
  });

  it('sorts by what the customer actually pays', () => {
    expect(ids(sortProducts(catalogue, 'price_asc'))).toBe('b2 p1 b1');
    expect(ids(sortProducts(catalogue, 'price_desc'))).toBe('b1 p1 b2');
  });

  it('falls back to the interleave for a sort value it does not know', () => {
    // Old shareable links carried ?sort=name_asc and ?sort=rating_desc.
    // Those options are gone; the page must still render sensibly.
    expect(ids(sortProducts(catalogue, 'rating_desc'))).toBe('b1 p1 b2');
  });
});
