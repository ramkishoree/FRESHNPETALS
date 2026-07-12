import { SetOutletStockService, type InventoryRecord } from '@prana/commerce';
import { BusinessRuleError, err, isOk } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { createApiRoute } from '@/server/http/route-handler';
import { SupabaseInventoryRepository } from '@/server/repositories/supabase-inventory-repository';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
  outletId: string;
}

const bodySchema = z.object({
  quantity: z.number().int().min(0),
  reason: z.string().optional(),
});

/**
 * PATCH /api/v1/admin/products/{id}/outlets/{outletId} — sets this
 * outlet's stock for this product. Owner's explicit call: price, sale
 * price, and photo stay uniform across every outlet (set once on the
 * product itself) — stock is the only per-outlet variable, so this is
 * the only per-outlet write left. Keyed on (productId, outletId) rather
 * than an inventory row id, since a brand-new product/outlet pair has no
 * row yet — the RPC creates one on first use instead of requiring it to
 * already exist.
 */
const setOutletStock = createApiRoute<
  undefined,
  InventoryRecord,
  z.infer<typeof bodySchema>,
  RouteParams
>({
  bodySchema,
  handler: async ({ body, request, params }) => {
    const actor = await requireAdmin();
    const idCheck = z
      .object({ id: zUuid(), outletId: zUuid() })
      .safeParse({ id: params.id, outletId: params.outletId });
    if (!idCheck.success) {
      return err(new BusinessRuleError('Invalid product or outlet id.', { httpStatus: 400 }));
    }

    const admin = createSupabaseAdminClient();
    const repository = new SupabaseInventoryRepository(admin);
    const service = new SetOutletStockService(repository);
    const result = await service.execute(
      params.id,
      params.outletId,
      body.quantity,
      actor.id,
      body.reason,
    );

    if (isOk(result)) {
      await recordAuditEvent({
        eventType: 'admin.inventory.stock_set',
        aggregateType: 'inventory',
        aggregateId: result.value.id,
        actor,
        service: 'inventory',
        next: { productId: params.id, outletId: params.outletId, quantity: body.quantity },
        request,
      });
    }

    return result;
  },
});

export async function PATCH(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return setOutletStock(request, await context.params);
}
