import type { NextRequest } from 'next/server';
import { zUuid } from '@/lib/uuid';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { apiError, apiSuccess } from '@/server/http/envelope';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
}

/**
 * GET /api/v1/admin/products/{id}/outlets — the read side of the
 * "outlet toggle" in the Products tab (owner's explicit ask: manage
 * stock/price/sale price/photo per outlet from inside Products, not
 * separate Inventory/Outlets tabs). One row per active outlet, each with
 * its real stock (inventory row, already per-outlet) and its resolved
 * price/image — the outlet's override if `product_outlet_overrides` has
 * one, otherwise the product's own global default. "Simple, minimal
 * effort": an outlet with no override row just always shows the default.
 */
export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;

  const correlationId = crypto.randomUUID();
  const { id: productId } = await context.params;
  const idCheck = zUuid().safeParse(productId);
  if (!idCheck.success) {
    return apiError('VALIDATION_ERROR', 'Invalid product id.', 400, correlationId);
  }

  const admin = createSupabaseAdminClient();

  const [{ data: product }, { data: outlets }, { data: overrides }, { data: inventoryRows }] =
    await Promise.all([
      admin
        .from('products')
        .select('id, featured_image, product_prices(base_price, sale_price)')
        .eq('id', productId)
        .maybeSingle(),
      admin
        .from('outlets')
        .select('id, name')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name'),
      admin
        .from('product_outlet_overrides')
        .select('id, outlet_id, base_price_override, sale_price_override, featured_image_override')
        .eq('product_id', productId),
      admin
        .from('inventory')
        .select('id, outlet_id, physical_quantity, reserved_quantity, available_quantity')
        .eq('product_id', productId),
    ]);

  if (!product) {
    return apiError('BUSINESS_RULE_ERROR', 'Product not found.', 404, correlationId);
  }

  const priceRow = Array.isArray(product.product_prices)
    ? product.product_prices[0]
    : product.product_prices;
  const overrideByOutlet = new Map((overrides ?? []).map((o) => [o.outlet_id, o]));
  const inventoryByOutlet = new Map((inventoryRows ?? []).map((r) => [r.outlet_id, r]));

  const items = (outlets ?? []).map((outlet) => {
    const override = overrideByOutlet.get(outlet.id);
    const inventory = inventoryByOutlet.get(outlet.id);
    return {
      outletId: outlet.id,
      outletName: outlet.name,
      inventoryId: inventory?.id ?? null,
      physicalQuantity: inventory?.physical_quantity ?? 0,
      availableQuantity: inventory?.available_quantity ?? 0,
      defaultBasePrice: priceRow?.base_price != null ? Number(priceRow.base_price) : null,
      defaultSalePrice: priceRow?.sale_price != null ? Number(priceRow.sale_price) : null,
      defaultFeaturedImage: product.featured_image,
      basePriceOverride:
        override?.base_price_override != null ? Number(override.base_price_override) : null,
      salePriceOverride:
        override?.sale_price_override != null ? Number(override.sale_price_override) : null,
      featuredImageOverride: override?.featured_image_override ?? null,
    };
  });

  return apiSuccess(items, { meta: { correlationId } });
}
