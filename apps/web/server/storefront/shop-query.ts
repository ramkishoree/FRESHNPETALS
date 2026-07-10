import type { Product, ProductStatus } from '@prana/commerce';

export const PRODUCT_SELECT_COLUMNS =
  'id, sku, slug, name, short_description, featured_image, status, created_at, product_prices(base_price, sale_price)';

interface ProductPriceRow {
  base_price: string | number;
  sale_price: string | number | null;
}

interface ProductRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  short_description: string | null;
  featured_image: string | null;
  status: ProductStatus;
  created_at: string;
  product_prices: ProductPriceRow | ProductPriceRow[] | null;
}

/** Same mapping as SupabaseProductRepository — duplicated rather than imported because storefront listing queries (category-filtered, sorted) don't fit the repository's fixed `list`/`findPublished` shapes cleanly. */
export function mapProductRow(row: ProductRow): Product {
  const priceRow = Array.isArray(row.product_prices)
    ? (row.product_prices[0] ?? null)
    : row.product_prices;
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    featuredImage: row.featured_image,
    status: row.status,
    basePrice: priceRow ? Number(priceRow.base_price) : 0,
    salePrice: priceRow?.sale_price != null ? Number(priceRow.sale_price) : null,
  };
}

/**
 * Ch.12 §20 lists "Newest" and "Best Rated" as sort options. Price lives
 * in the joined `product_prices` table, which PostgREST's query builder
 * can't order by directly here — rather than silently mislabeling a
 * `created_at` sort as "Price," that option isn't offered until a real
 * price-aware query (a view, or an RPC) backs it. "Best Rated" needs an
 * aggregate review score per product, same story — deferred alongside it.
 */
export function sortToOrderBy(sort?: string): { column: string; ascending: boolean } {
  switch (sort) {
    case 'name_asc':
      return { column: 'name', ascending: true };
    case 'newest':
    default:
      return { column: 'created_at', ascending: false };
  }
}
