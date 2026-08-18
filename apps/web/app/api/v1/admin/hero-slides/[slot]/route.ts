import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { apiError, apiSuccess } from '@/server/http/envelope';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  slot: string;
}

/**
 * DELETE /api/v1/admin/hero-slides/{slot} — empty a hero slot.
 *
 * A hard delete, not a soft one: the slot is addressed by number, so a
 * tombstone row would occupy the unique `slot_order` and block the next
 * upload. The stored file is left in the bucket — orphaned media costs
 * pennies, and deleting bytes an admin may still want back is the
 * expensive mistake.
 */
export async function DELETE(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;

  const correlationId = crypto.randomUUID();
  const actor = await requireAdmin();
  const { slot } = await context.params;
  const slotOrder = Number(slot);

  if (!Number.isInteger(slotOrder) || slotOrder < 1 || slotOrder > 4) {
    return apiError('VALIDATION_ERROR', 'Slot must be 1, 2, 3 or 4.', 400, correlationId);
  }

  const admin = createSupabaseAdminClient();
  // Read the row first: `event_store.aggregate_id` is a uuid column, so
  // the audit record needs the slide's real id, and after the delete
  // there is nothing left to ask.
  const { data: existing } = await admin
    .from('hero_slides')
    .select('id')
    .eq('slot_order', slotOrder)
    .maybeSingle();

  const { error } = await admin.from('hero_slides').delete().eq('slot_order', slotOrder);
  if (error) return apiError('INFRASTRUCTURE_ERROR', error.message, 500, correlationId);

  if (existing) {
    await recordAuditEvent({
      eventType: 'admin.hero_slide.removed',
      aggregateType: 'hero_slide',
      aggregateId: existing.id,
      actor,
      service: 'hero',
      severity: 'warning',
      request,
    });
  }

  return apiSuccess({ slotOrder }, { meta: { correlationId } });
}
