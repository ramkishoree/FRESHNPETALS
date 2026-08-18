import type {
  AdminProductFilter,
  AdminProductInput,
  AdminProductRepository,
  Product,
  ProductStatus,
} from '@prana/commerce';
import type { PagedResult, Pagination } from '@prana/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeForPostgrestFilter } from '@/lib/postgrest-filter';
import { stripUndefined } from '@/lib/strip-undefined';
import {
  mapRow,
  SELECT_COLUMNS,
  type ProductRow,
  SupabaseProductRepository,
} from './supabase-product-repository';

/**
 * Ch.11 §6 infrastructure implementation of AdminProductRepository. Uses
 * the RPC functions from migration 0025 for the two writes that cross
 * products/product_prices/product_price_history — a sequence of separate
 * `.from(...).insert(...)` calls would give no cross-table atomicity (see
 * packages/core/src/repository.ts).
 */
export class SupabaseAdminProductRepository
  extends SupabaseProductRepository
  implements AdminProductRepository
{
  constructor(private readonly adminClient: SupabaseClient) {
    super(adminClient);
  }

  async create(input: AdminProductInput, actorId: string): Promise<Product> {
    const { data: productId, error } = await this.adminClient.rpc('admin_create_product', {
      p_sku: input.sku,
      p_slug: input.slug,
      p_name: input.name,
      p_description: input.description,
      p_category_id: input.categoryId,
      p_base_price: input.basePrice,
      p_featured_image: input.featuredImage,
      p_actor_id: actorId,
      p_short_description: input.shortDescription ?? null,
      p_collection_id: input.collectionId ?? null,
      p_sale_price: input.salePrice ?? null,
      p_seo_title: input.seoTitle ?? null,
      p_meta_description: input.metaDescription ?? null,
      p_focus_keyword: input.focusKeyword,
      p_additional_images: input.additionalImages ?? [],
    });

    if (error) throw new Error(error.message);

    // `admin_create_product` has a fixed parameter list, and widening a
    // stored procedure for one nullable text column is a worse trade
    // than a follow-up write. Colour is optional, so a failure here
    // must not fail the product creation that already succeeded.
    const postCreateFields = stripUndefined({
      color: input.color,
      type: input.type,
      owner_description: input.ownerDescription,
      // `admin_create_product` has a fixed parameter list and always
      // inserts as 'draft', so an explicit choice is applied here.
      status: input.status,
    });
    if (Object.keys(postCreateFields).length > 0) {
      await this.adminClient
        .from('products')
        .update(postCreateFields)
        .eq('id', productId as string);
    }

    const created = await this.findById(productId as string);
    if (!created) throw new Error('Product created but could not be re-read.');
    return created;
  }

  async update(id: string, input: Partial<AdminProductInput>, actorId: string): Promise<Product> {
    const { basePrice, salePrice, additionalImages, focusKeyword, ...productFields } = input;

    const productPatch: Record<string, unknown> = {};
    if (productFields.sku !== undefined) productPatch['sku'] = productFields.sku;
    if (productFields.slug !== undefined) productPatch['slug'] = productFields.slug;
    if (productFields.name !== undefined) productPatch['name'] = productFields.name;
    if (productFields.shortDescription !== undefined) {
      productPatch['short_description'] = productFields.shortDescription;
    }
    if (productFields.color !== undefined) productPatch['color'] = productFields.color;
    if (productFields.type !== undefined) productPatch['type'] = productFields.type;
    if (productFields.ownerDescription !== undefined)
      productPatch['owner_description'] = productFields.ownerDescription;
    if (productFields.description !== undefined)
      productPatch['description'] = productFields.description;
    if (productFields.categoryId !== undefined)
      productPatch['category_id'] = productFields.categoryId;
    if (productFields.collectionId !== undefined)
      productPatch['collection_id'] = productFields.collectionId;
    if (productFields.seoTitle !== undefined) productPatch['seo_title'] = productFields.seoTitle;
    if (productFields.metaDescription !== undefined) {
      productPatch['meta_description'] = productFields.metaDescription;
    }
    if (productFields.featuredImage !== undefined)
      productPatch['featured_image'] = productFields.featuredImage;
    if (focusKeyword !== undefined || additionalImages !== undefined) {
      const { data: current } = await this.adminClient
        .from('products')
        .select('metadata')
        .eq('id', id)
        .single();
      const existingMetadata = (current?.metadata as Record<string, unknown> | null) ?? {};
      productPatch['metadata'] = {
        ...existingMetadata,
        ...(focusKeyword !== undefined ? { focusKeyword } : {}),
        ...(additionalImages !== undefined ? { additionalImages } : {}),
      };
    }
    if (Object.keys(productPatch).length > 0) {
      productPatch['updated_by'] = actorId;
      const { error } = await this.adminClient.from('products').update(productPatch).eq('id', id);
      if (error) throw new Error(error.message);
    }

    if (basePrice !== undefined || salePrice !== undefined) {
      const { data: priceRow } = await this.adminClient
        .from('product_prices')
        .select('base_price, sale_price')
        .eq('product_id', id)
        .single();

      const { error } = await this.adminClient.rpc('admin_update_product_price', {
        p_product_id: id,
        p_base_price: basePrice ?? Number(priceRow?.base_price ?? 0),
        p_sale_price:
          salePrice ?? (priceRow?.sale_price != null ? Number(priceRow.sale_price) : null),
        p_actor_id: actorId,
        p_reason: 'Administrator price update.',
      });
      if (error) throw new Error(error.message);
    }

    const updated = await this.findById(id);
    if (!updated) throw new Error('Product updated but could not be re-read.');
    return updated;
  }

  async updateStatus(id: string, status: ProductStatus, actorId: string): Promise<Product> {
    const patch: Record<string, unknown> = { status, updated_by: actorId };
    if (status === 'published') patch['ever_published'] = true;

    const { error } = await this.adminClient.from('products').update(patch).eq('id', id);
    if (error) throw new Error(error.message);

    const updated = await this.findById(id);
    if (!updated) throw new Error('Product updated but could not be re-read.');
    return updated;
  }

  async list(filter: AdminProductFilter, pagination: Pagination): Promise<PagedResult<Product>> {
    let queryBuilder = this.adminClient
      .from('products')
      .select(SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(pagination.limit);

    if (filter.status) queryBuilder = queryBuilder.eq('status', filter.status);
    if (filter.search) {
      const safeSearch = sanitizeForPostgrestFilter(filter.search);
      if (safeSearch) {
        queryBuilder = queryBuilder.or(`name.ilike.%${safeSearch}%,sku.ilike.%${safeSearch}%`);
      }
    }
    if (pagination.cursor) queryBuilder = queryBuilder.lt('created_at', pagination.cursor);

    const { data, error } = await queryBuilder;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as ProductRow[];
    const items = rows.map(mapRow);
    const nextCursor = rows.length === pagination.limit ? (rows.at(-1)?.created_at ?? null) : null;

    return { items, nextCursor };
  }

  async hasBeenPublished(id: string): Promise<boolean> {
    const { data, error } = await this.adminClient
      .from('products')
      .select('ever_published')
      .eq('id', id)
      .single();
    if (error) throw new Error(error.message);
    return Boolean(data?.ever_published);
  }
}
