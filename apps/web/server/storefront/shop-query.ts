import type { Product, ProductStatus } from '@prana/commerce';

export const PRODUCT_SELECT_COLUMNS =
  'id, sku, slug, name, short_description, color, type, featured_image, status, created_at, product_prices(base_price, sale_price), inventory(available_quantity, outlets(is_active, deleted_at)), product_media(url, media_type, position), reviews(rating, status, deleted_at)';

interface ProductPriceRow {
  base_price: string | number;
  sale_price: string | number | null;
}

interface ProductInventoryRow {
  available_quantity: number;
  outlets:
    | { is_active: boolean; deleted_at: string | null }
    | { is_active: boolean; deleted_at: string | null }[]
    | null;
}

interface ProductMediaRow {
  url: string;
  media_type: string;
  position: number;
}

interface ProductReviewRow {
  rating: number;
  deleted_at: string | null;
  status: string;
}

interface ProductRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  short_description: string | null;
  color: string | null;
  type: string | null;
  featured_image: string | null;
  status: ProductStatus;
  created_at: string;
  product_prices: ProductPriceRow | ProductPriceRow[] | null;
  inventory: ProductInventoryRow[] | null;
  product_media: ProductMediaRow[] | null;
  reviews: ProductReviewRow[] | null;
}

/**
 * A catalogue product plus the two aggregates the listing sorts on but
 * the shared `Product` domain type does not carry. Kept local to the
 * storefront rather than widened into @prana/commerce, because nothing
 * else in the system needs a product to know its own review average.
 */
export interface StorefrontProduct extends Product {
  /** Mean of approved review ratings, or null when there are none. */
  averageRating: number | null;
  approvedReviewCount: number;
}

/** Same mapping as SupabaseProductRepository — duplicated rather than imported because storefront listing queries (category-filtered, sorted) don't fit the repository's fixed `list`/`findPublished` shapes cleanly. */
export function mapProductRow(row: ProductRow): StorefrontProduct {
  const approvedRatings = (row.reviews ?? [])
    // `deleted_at` is checked here rather than trusted to RLS: the admin
    // policy is permissive, so a removed review would otherwise still
    // count toward the average an owner sees.
    .filter((review) => review.status === 'approved' && review.deleted_at == null)
    .map((review) => Number(review.rating))
    .filter((rating) => Number.isFinite(rating));
  const priceRow = Array.isArray(row.product_prices)
    ? (row.product_prices[0] ?? null)
    : row.product_prices;
  const galleryUrls = (row.product_media ?? [])
    .filter((item) => item.media_type === 'image')
    .sort((a, b) => a.position - b.position)
    .map((item) => item.url);
  const images = [
    ...(row.featured_image ? [row.featured_image] : []),
    ...galleryUrls.filter((url) => url !== row.featured_image),
  ];
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    color: row.color ?? null,
    type: row.type ?? null,
    featuredImage: row.featured_image,
    images,
    status: row.status,
    basePrice: priceRow ? Number(priceRow.base_price) : 0,
    salePrice: priceRow?.sale_price != null ? Number(priceRow.sale_price) : null,
    availableQuantity: (row.inventory ?? [])
      .filter((inv) => {
        const outlet = Array.isArray(inv.outlets) ? inv.outlets[0] : inv.outlets;
        return outlet != null && outlet.is_active && !outlet.deleted_at;
      })
      .reduce((sum, inv) => sum + Number(inv.available_quantity), 0),
    averageRating:
      approvedRatings.length > 0
        ? approvedRatings.reduce((sum, rating) => sum + rating, 0) / approvedRatings.length
        : null,
    approvedReviewCount: approvedRatings.length,
  };
}

/**
 * Every sort the storefront offers. `value` is what appears in `?sort=`,
 * so these strings are part of the URL contract and shareable.
 */
export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'stock_desc', label: 'Stock: high to low' },
  { value: 'rating_desc', label: 'Rating: high to low' },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export const DEFAULT_SORT: SortValue = 'newest';

export function isSortValue(value: string | undefined): value is SortValue {
  return SORT_OPTIONS.some((option) => option.value === value);
}

/**
 * The order the rows are fetched in. Price, stock and rating all live in
 * joined tables or are aggregates, and PostgREST cannot order by those
 * here — so this only covers the two real columns, and everything else
 * sorts in `sortProducts` below. It still runs for those cases, because
 * a deterministic fetch order is what keeps ties stable between loads.
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

/** What a customer actually pays — the sale price when there is one. */
function effectivePrice(product: StorefrontProduct): number {
  return product.salePrice ?? product.basePrice;
}

/**
 * Sorting in memory rather than in SQL is deliberate and not a shortcut:
 * the catalogue page is explicitly unpaginated (the owner's call — every
 * product on one page), so the full set is already in hand, and the
 * alternative is a database view or RPC per sort key for a catalogue in
 * the dozens. If the catalogue ever grows past a few hundred products,
 * pagination has to come back first, and this moves into the query.
 *
 * Every comparator falls back to the fetch order for ties, so equal
 * prices or equal stock do not shuffle between page loads.
 */
export function sortProducts(products: StorefrontProduct[], sort?: string): StorefrontProduct[] {
  const sorted = [...products];
  switch (sort) {
    case 'price_asc':
      return sorted.sort((a, b) => effectivePrice(a) - effectivePrice(b));
    case 'price_desc':
      return sorted.sort((a, b) => effectivePrice(b) - effectivePrice(a));
    case 'stock_desc':
      return sorted.sort((a, b) => b.availableQuantity - a.availableQuantity);
    case 'rating_desc':
      // Unrated products sort last rather than as zero — an unreviewed
      // product is not a badly-reviewed one, and burying it under
      // genuine 1-star ratings would misrepresent it.
      return sorted.sort((a, b) => {
        if (a.averageRating === null && b.averageRating === null) return 0;
        if (a.averageRating === null) return 1;
        if (b.averageRating === null) return -1;
        return b.averageRating - a.averageRating;
      });
    default:
      // `newest` and `name_asc` were already applied by the database.
      return sorted;
  }
}
