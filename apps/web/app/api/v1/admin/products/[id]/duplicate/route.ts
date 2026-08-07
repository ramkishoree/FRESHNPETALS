import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { createApiRoute } from '@/server/http/route-handler';
import { deriveSku, deriveSlug } from '@/server/products/derive-identifiers';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
}

/**
 * Copies a listing so a near-identical product takes seconds instead of
 * a full form.
 *
 * Most of this catalogue is variations on a theme — the same arrangement
 * in a different colour or size — and retyping the description, price,
 * category and photo every time is the slow part of adding stock.
 *
 * The copy is always created as a **draft**. A duplicate is by
 * definition not ready to sell: it still has the original's name and
 * photo, and publishing it automatically would put two identical
 * products in the shop the moment the button is pressed.
 *
 * Slug and SKU are re-derived rather than copied, since both are unique.
 */
const duplicateProduct = createApiRoute<undefined, unknown, undefined, RouteParams>({
  handler: async ({ params, request }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();

    const { data: source, error: readError } = await admin
      .from('products')
      .select(
        'name, description, short_description, category_id, collection_id, featured_image, color, owner_description, seo_title, meta_description, metadata, product_prices(base_price, sale_price)',
      )
      .eq('id', params.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (readError)
      return err(
        new InfrastructureError('Failed to read the product.', { cause: readError.message }),
      );
    if (!source) return err(new BusinessRuleError('Product not found.', { httpStatus: 404 }));

    const name = `${source.name as string} (copy)`;
    const [slug, sku] = await Promise.all([deriveSlug(admin, name), deriveSku(admin, name)]);

    const { data: created, error: insertError } = await admin
      .from('products')
      .insert({
        name,
        slug,
        sku,
        description: source.description,
        short_description: source.short_description,
        category_id: source.category_id,
        collection_id: source.collection_id,
        featured_image: source.featured_image,
        color: source.color,
        owner_description: source.owner_description,
        seo_title: source.seo_title,
        meta_description: source.meta_description,
        metadata: source.metadata ?? {},
        status: 'draft',
        created_by: actor.id,
      })
      .select('id, name, slug')
      .single();

    if (insertError || !created)
      return err(
        new InfrastructureError('Failed to duplicate the product.', {
          cause: insertError?.message,
        }),
      );

    // Price lives in its own table, so a copy without it would look free.
    const price = Array.isArray(source.product_prices)
      ? source.product_prices[0]
      : source.product_prices;
    if (price) {
      await admin.from('product_prices').insert({
        product_id: created.id,
        base_price: price.base_price,
        sale_price: price.sale_price,
      });
    }

    await recordAuditEvent({
      eventType: 'admin.product.duplicated',
      aggregateType: 'product',
      aggregateId: created.id as string,
      actor,
      service: 'products',
      next: { copiedFrom: params.id, name },
      request,
    });

    return ok(created);
  },
});

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return duplicateProduct(request, await context.params);
}
