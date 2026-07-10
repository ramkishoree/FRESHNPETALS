import { type Order, UpdateOrderStatusService } from '@prana/commerce';
import {
  type AppError,
  BusinessRuleError,
  InfrastructureError,
  isOk,
  ok,
  type Result,
} from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { createApiRoute } from '@/server/http/route-handler';
import { SupabaseOrderRepository } from '@/server/repositories/supabase-order-repository';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
}

const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
  'failed',
  'refunded',
] as const;

/**
 * Ch.16 §97: "Status Update... Internal Notes..." — status transitions
 * and notes are independent fields on the same PATCH; either, both, or
 * neither may be present (a bare GET-via-PATCH-with-no-fields re-reads
 * the current order rather than erroring).
 */
const bodySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  notes: z.string().optional(),
});

const updateOrder = createApiRoute<undefined, Order, z.infer<typeof bodySchema>, RouteParams>({
  bodySchema,
  handler: async ({ body, request, params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const repository = new SupabaseOrderRepository(admin);

    let result: Result<Order, AppError>;

    if (body.status !== undefined) {
      result = await new UpdateOrderStatusService(repository).execute(
        params.id,
        body.status,
        actor.id,
        body.notes,
      );
    } else if (body.notes !== undefined) {
      try {
        result = ok(await repository.updateNotes(params.id, body.notes));
      } catch (cause) {
        result = {
          ok: false,
          error: new InfrastructureError('Failed to update order notes.', {
            cause: cause instanceof Error ? cause.message : String(cause),
          }),
        };
      }
    } else {
      const current = await repository.findById(params.id);
      result = current
        ? ok(current)
        : { ok: false, error: new BusinessRuleError('Order not found.', { httpStatus: 404 }) };
    }

    if (isOk(result)) {
      await recordAuditEvent({
        eventType:
          body.status !== undefined ? 'admin.order.status_changed' : 'admin.order.notes_updated',
        aggregateType: 'order',
        aggregateId: params.id,
        actor,
        service: 'orders',
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
  return updateOrder(request, await context.params);
}
