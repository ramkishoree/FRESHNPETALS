import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
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

const bodySchema = z.object({ show: z.boolean() });

/**
 * Chooses the single outlet whose Google reviews appear on the site.
 *
 * Its own endpoint rather than a field on the generic outlet PATCH,
 * because turning one on means turning every other one off — that is a
 * single decision about the whole set, not an edit to one row. Going
 * through the CRUD route would let two clicks land two enabled outlets.
 *
 * Order matters: clear every outlet first, then set the chosen one.
 * `idx_outlets_single_reviews_source` is a partial unique index, and
 * unique indexes are checked per row as a statement runs — enabling
 * before disabling would trip it even though the end state is legal.
 *
 * Google returns at most 5 reviews per place, so two sources would show
 * an arbitrary handful from each rather than one shop's real record.
 */
const setReviewsSource = createApiRoute<
  undefined,
  unknown,
  z.infer<typeof bodySchema>,
  RouteParams
>({
  bodySchema,
  handler: async ({ body, params, request }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();

    if (body.show) {
      // Only a linked outlet has reviews to show, and an unverified
      // link once put another florist's reviews on the site — so the
      // link has to exist before it can speak for the brand.
      const { data: outlet } = await admin
        .from('outlets')
        .select('id, google_place_id')
        .eq('id', params.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (!outlet) return err(new BusinessRuleError('Outlet not found.', { httpStatus: 404 }));
      if (!outlet.google_place_id) {
        return err(
          new BusinessRuleError('Link this outlet to Google Business before showing its reviews.'),
        );
      }
    }

    const { error: clearError } = await admin
      .from('outlets')
      .update({ show_google_reviews: false })
      .eq('show_google_reviews', true);
    if (clearError) {
      return err(
        new InfrastructureError('Failed to update the reviews source.', {
          cause: clearError.message,
        }),
      );
    }

    if (body.show) {
      const { error: setError } = await admin
        .from('outlets')
        .update({ show_google_reviews: true })
        .eq('id', params.id);
      if (setError) {
        return err(
          new InfrastructureError('Failed to update the reviews source.', {
            cause: setError.message,
          }),
        );
      }
    }

    await recordAuditEvent({
      eventType: 'admin.outlet.reviews_source_changed',
      aggregateType: 'outlet',
      aggregateId: params.id,
      actor,
      service: 'outlets',
      next: { showGoogleReviews: body.show },
      request,
    });

    return ok({ id: params.id, showGoogleReviews: body.show });
  },
});

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return setReviewsSource(request, await context.params);
}
