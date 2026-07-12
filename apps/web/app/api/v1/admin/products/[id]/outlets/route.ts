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
 * per-outlet stock editor in the Products tab. Owner's explicit call:
 * price/sale price/photo stay uniform across every outlet (set once on
 * the product itself) — stock is the only thing that varies per outlet.
 * One row per active outlet with its real stock (inventory row, already
 * per-outlet, defaulting to zero when no row exists yet).
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

  const [{ data: product }, { data: outlets }, { data: inventoryRows }] = await Promise.all([
    admin.from('products').select('id').eq('id', productId).maybeSingle(),
    admin
      .from('outlets')
      .select('id, name')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name'),
    admin
      .from('inventory')
      .select('id, outlet_id, physical_quantity, reserved_quantity, available_quantity')
      .eq('product_id', productId),
  ]);

  if (!product) {
    return apiError('BUSINESS_RULE_ERROR', 'Product not found.', 404, correlationId);
  }

  const inventoryByOutlet = new Map((inventoryRows ?? []).map((r) => [r.outlet_id, r]));

  const items = (outlets ?? []).map((outlet) => {
    const inventory = inventoryByOutlet.get(outlet.id);
    return {
      outletId: outlet.id,
      outletName: outlet.name,
      physicalQuantity: inventory?.physical_quantity ?? 0,
      availableQuantity: inventory?.available_quantity ?? 0,
    };
  });

  return apiSuccess(items, { meta: { correlationId } });
}
