import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { apiError, apiSuccess } from '@/server/http/envelope';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
  outletId: string;
}

const bodySchema = z.object({
  basePriceOverride: z.number().positive().nullable().optional(),
  salePriceOverride: z.number().positive().nullable().optional(),
  featuredImageOverride: z.string().nullable().optional(),
});

/**
 * PUT /api/v1/admin/products/{id}/outlets/{outletId} — set or clear this
 * outlet's override for one product. A field left `null` clears back to
 * the product's global default (not "set price to zero") — upsert keeps
 * this a single call whether the override row already exists or not.
 * If every field ends up null, the row is deleted rather than kept as an
 * empty override — "no override" and "an override with nothing set" are
 * the same state, no reason to keep a dead row around.
 */
export async function PUT(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;

  const correlationId = crypto.randomUUID();
  const actor = await requireAdmin();
  const { id: productId, outletId } = await context.params;

  const idCheck = z
    .object({ id: zUuid(), outletId: zUuid() })
    .safeParse({ id: productId, outletId });
  if (!idCheck.success) {
    return apiError('VALIDATION_ERROR', 'Invalid product or outlet id.', 400, correlationId);
  }

  const raw = await request.json().catch(() => undefined);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid override payload.', 400, correlationId);
  }
  const { basePriceOverride, salePriceOverride, featuredImageOverride } = parsed.data;

  const admin = createSupabaseAdminClient();

  const allNull =
    (basePriceOverride ?? null) === null &&
    (salePriceOverride ?? null) === null &&
    (featuredImageOverride ?? null) === null;

  if (allNull) {
    const { error } = await admin
      .from('product_outlet_overrides')
      .delete()
      .eq('product_id', productId)
      .eq('outlet_id', outletId);
    if (error) {
      return apiError('INFRASTRUCTURE_ERROR', error.message, 500, correlationId);
    }
    await recordAuditEvent({
      eventType: 'admin.product_outlet_override.cleared',
      aggregateType: 'product',
      aggregateId: productId,
      actor,
      service: 'products',
      next: { outletId },
      request,
    });
    return apiSuccess({ cleared: true }, { meta: { correlationId } });
  }

  const { data, error } = await admin
    .from('product_outlet_overrides')
    .upsert(
      {
        product_id: productId,
        outlet_id: outletId,
        base_price_override: basePriceOverride ?? null,
        sale_price_override: salePriceOverride ?? null,
        featured_image_override: featuredImageOverride ?? null,
      },
      { onConflict: 'product_id,outlet_id' },
    )
    .select()
    .single();

  if (error) {
    return apiError('INFRASTRUCTURE_ERROR', error.message, 500, correlationId);
  }

  await recordAuditEvent({
    eventType: 'admin.product_outlet_override.set',
    aggregateType: 'product',
    aggregateId: productId,
    actor,
    service: 'products',
    next: { outletId, basePriceOverride, salePriceOverride, featuredImageOverride },
    request,
  });

  return apiSuccess(data, { meta: { correlationId } });
}
