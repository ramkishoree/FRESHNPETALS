import { AdjustInventoryService, type InventoryRecord } from '@prana/commerce';
import { isOk } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { createApiRoute } from '@/server/http/route-handler';
import { SupabaseInventoryRepository } from '@/server/repositories/supabase-inventory-repository';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
}

/** Ch.16 §95: "Stock Adjustment, Reserved Quantity, Damaged Quantity, Incoming Stock, Reason." */
const bodySchema = z.object({
  transactionType: z.enum(['stock_added', 'damage', 'correction']),
  quantityDelta: z.number().int(),
  reason: z.string().optional(),
});

const adjustInventory = createApiRoute<
  undefined,
  InventoryRecord,
  z.infer<typeof bodySchema>,
  RouteParams
>({
  bodySchema,
  handler: async ({ body, request, params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const repository = new SupabaseInventoryRepository(admin);
    const service = new AdjustInventoryService(repository);
    const result = await service.execute(
      params.id,
      {
        transactionType: body.transactionType,
        quantityDelta: body.quantityDelta,
        ...(body.reason !== undefined ? { reason: body.reason } : {}),
      },
      actor.id,
    );

    if (isOk(result)) {
      await recordAuditEvent({
        eventType: 'admin.inventory.adjusted',
        aggregateType: 'inventory',
        aggregateId: params.id,
        actor,
        service: 'inventory',
        next: body,
        request,
      });
    }

    return result;
  },
});

export async function PATCH(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return adjustInventory(request, await context.params);
}
