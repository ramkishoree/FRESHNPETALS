import { err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
}

/** Ch.16 §99: Approve / Reject moderation actions, tracked via `moderated_by`/`moderated_at` (not the generic `updated_by`, which this table doesn't have). */
const bodySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
});

const moderateReview = createApiRoute<
  undefined,
  { id: string; status: string },
  z.infer<typeof bodySchema>,
  RouteParams
>({
  bodySchema,
  handler: async ({ body, request, params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();

    const { error } = await admin
      .from('reviews')
      .update({
        status: body.status,
        moderated_by: actor.id,
        moderated_at: new Date().toISOString(),
      })
      .eq('id', params.id);

    if (error) {
      return err(new InfrastructureError('Failed to moderate review.', { cause: error.message }));
    }

    await recordAuditEvent({
      eventType: 'admin.review.moderated',
      aggregateType: 'review',
      aggregateId: params.id,
      actor,
      service: 'reviews',
      next: body,
      request,
    });

    return ok({ id: params.id, status: body.status });
  },
});

export async function PATCH(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return moderateReview(request, await context.params);
}

/**
 * Removes a review from the site.
 *
 * Public reviews publish the moment they are written, so the owner needs
 * a way to take one down when it turns out to be spam or abuse. Soft
 * delete rather than a hard one: `reviews_select_approved` filters on
 * `deleted_at`, so it vanishes from the storefront immediately while the
 * row survives for the audit trail.
 *
 * The uploaded images are deliberately left in storage — orphaned files
 * are cheap, and a delete that also destroys evidence is the wrong
 * default for something the owner may need to report.
 */
const deleteReview = createApiRoute<undefined, { id: string }, undefined, RouteParams>({
  handler: async ({ request, params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();

    const { error } = await admin
      .from('reviews')
      .update({
        deleted_at: new Date().toISOString(),
        moderated_by: actor.id,
        moderated_at: new Date().toISOString(),
      })
      .eq('id', params.id);

    if (error) {
      return err(new InfrastructureError('Failed to delete review.', { cause: error.message }));
    }

    await recordAuditEvent({
      eventType: 'admin.review.deleted',
      aggregateType: 'review',
      aggregateId: params.id,
      actor,
      service: 'reviews',
      severity: 'warning',
      request,
    });

    return ok({ id: params.id });
  },
});

export async function DELETE(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return deleteReview(request, await context.params);
}
