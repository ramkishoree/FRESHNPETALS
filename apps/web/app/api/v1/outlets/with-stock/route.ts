import type { NextRequest } from 'next/server';
import { InfrastructureError, BusinessRuleError, err, ok } from '@prana/core';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/**
 * GET /api/v1/outlets/with-stock?productIds=uuid1,uuid2
 *
 * Returns every active outlet with its inventory levels for the requested
 * products, plus the outlet's coordinates so the client can compute
 * distances to the delivery pin. Used by the checkout page so the
 * customer can compare stock availability and pick which outlet fulfills
 * their order (like Blinkit/Zomato outlet selection).
 */
const querySchema = z.object({
  productIds: z.string().min(1),
});

const route = createApiRoute({
  querySchema,
  handler: async ({ query }) => {
    const ids = query.productIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return err(new BusinessRuleError('At least one productId is required.'));
    }

    const admin = createSupabaseAdminClient();

    const { data: outlets, error: outletErr } = await admin
      .from('outlets')
      .select(
        'id, name, slug, address, city, latitude, longitude, delivery_radius_km, google_business_name, google_rating, google_rating_count',
      )
      .eq('is_active', true)
      .is('deleted_at', null);

    if (outletErr) {
      return err(new InfrastructureError('Failed to load outlets.', { cause: outletErr.message }));
    }

    if (!outlets || outlets.length === 0) {
      return ok([]);
    }

    const { data: inventory, error: invErr } = await admin
      .from('inventory')
      .select('product_id, outlet_id, available_quantity')
      .in(
        'outlet_id',
        outlets.map((o) => o.id),
      )
      .in('product_id', ids);

    if (invErr) {
      return err(new InfrastructureError('Failed to load inventory.', { cause: invErr.message }));
    }

    // Build lookup: outlet_id → { product_id → available_quantity }
    const invMap = new Map<string, Map<string, number>>();
    for (const row of inventory ?? []) {
      if (!invMap.has(row.outlet_id)) {
        invMap.set(row.outlet_id, new Map());
      }
      invMap.get(row.outlet_id)!.set(row.product_id, row.available_quantity);
    }

    const result = outlets.map((outlet) => {
      const outletInv = invMap.get(outlet.id) ?? new Map();
      const stock: Record<string, number> = {};
      for (const pid of ids) {
        stock[pid] = outletInv.get(pid) ?? 0;
      }
      return {
        id: outlet.id,
        name: outlet.name,
        slug: outlet.slug,
        address: outlet.address,
        city: outlet.city,
        latitude: Number(outlet.latitude),
        longitude: Number(outlet.longitude),
        deliveryRadiusKm: Number(outlet.delivery_radius_km),
        googleBusinessName: outlet.google_business_name as string | null,
        googleRating: outlet.google_rating != null ? Number(outlet.google_rating) : null,
        googleRatingCount: outlet.google_rating_count as number | null,
        stock,
      };
    });

    return ok(result);
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return route(request);
}
