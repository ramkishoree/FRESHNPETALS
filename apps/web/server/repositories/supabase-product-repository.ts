import type { PagedResult, Pagination } from '@prana/core';
import type { Product, ProductRepository, ProductStatus } from '@prana/commerce';
import type { SupabaseClient } from '@supabase/supabase-js';

export const SELECT_COLUMNS =
  'id, sku, slug, name, short_description, featured_image, status, created_at, product_prices(base_price, sale_price), inventory(available_quantity, outlets(is_active, deleted_at)), product_media(url, media_type, position)';

export interface ProductPriceRow {
  base_price: string | number;
  sale_price: string | number | null;
}

export interface ProductInventoryRow {
  available_quantity: number;
  // A soft-deleted outlet's own `is_active` flag is never flipped to
  // false (a real, separate bug — deleted_at is set but is_active stays
  // true), so a stale outlet's inventory row would otherwise still count
  // toward "in stock" — deleted_at is the one that's actually reliable.
  outlets:
    | { is_active: boolean; deleted_at: string | null }
    | { is_active: boolean; deleted_at: string | null }[]
    | null;
}

export interface ProductMediaRow {
  url: string;
  media_type: string;
  position: number;
}

export interface ProductRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  short_description: string | null;
  featured_image: string | null;
  status: ProductStatus;
  created_at: string;
  product_prices: ProductPriceRow | ProductPriceRow[] | null;
  inventory: ProductInventoryRow[] | null;
  product_media: ProductMediaRow[] | null;
}

/** featuredImage first (the card's default/cover photo), then product_media
 *  photos in position order — a listing card hovers through this list for
 *  a quick preview instead of just the one static featuredImage. */
export function buildImageList(featuredImage: string | null, media: ProductMediaRow[]): string[] {
  const galleryUrls = [...media]
    .filter((item) => item.media_type === 'image')
    .sort((a, b) => a.position - b.position)
    .map((item) => item.url);
  return [
    ...(featuredImage ? [featuredImage] : []),
    ...galleryUrls.filter((url) => url !== featuredImage),
  ];
}

export function mapRow(row: ProductRow): Product {
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
    images: buildImageList(row.featured_image, row.product_media ?? []),
    status: row.status,
    basePrice: priceRow ? Number(priceRow.base_price) : 0,
    salePrice: priceRow?.sale_price != null ? Number(priceRow.sale_price) : null,
    // Summed across every active outlet's inventory row (see Product's own
    // doc comment) — a product with no inventory rows at all reads as 0,
    // same as one that's been fully sold out everywhere.
    availableQuantity: (row.inventory ?? [])
      .filter((inv) => {
        const outlet = Array.isArray(inv.outlets) ? inv.outlets[0] : inv.outlets;
        return outlet != null && outlet.is_active && !outlet.deleted_at;
      })
      .reduce((sum, inv) => sum + Number(inv.available_quantity), 0),
  };
}

/**
 * Ch.11 §6: infrastructure implementation of the domain-level
 * ProductRepository interface. Every table read/write here is still
 * subject to RLS (infrastructure/database/migrations/0012) — this class
 * doesn't bypass anything, it just knows how to talk to Postgres.
 */
export class SupabaseProductRepository implements ProductRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(id: string): Promise<Product | null> {
    const { data, error } = await this.client
      .from('products')
      .select(SELECT_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapRow(data as unknown as ProductRow) : null;
  }

  async findMany(pagination: Pagination): Promise<PagedResult<Product>> {
    return this.query(pagination);
  }

  async findPublished(pagination: Pagination): Promise<PagedResult<Product>> {
    return this.query(pagination, 'published');
  }

  private async query(
    pagination: Pagination,
    status?: ProductStatus,
  ): Promise<PagedResult<Product>> {
    let queryBuilder = this.client
      .from('products')
      .select(SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(pagination.limit);

    if (status) queryBuilder = queryBuilder.eq('status', status);
    if (pagination.cursor) queryBuilder = queryBuilder.lt('created_at', pagination.cursor);

    const { data, error } = await queryBuilder;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as ProductRow[];
    const items = rows.map(mapRow);
    const nextCursor = rows.length === pagination.limit ? (rows.at(-1)?.created_at ?? null) : null;

    return { items, nextCursor };
  }
}
