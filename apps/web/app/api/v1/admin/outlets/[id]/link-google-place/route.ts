import { err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { fetchGooglePlaceDetails } from '@/server/outlets/google-places';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
}

const bodySchema = z.object({
  placeId: z.string().min(1),
  // Real coordinates from the Autocomplete result the admin just picked —
  // this is now the only way an outlet's lat/lng get set to something
  // other than the create-time default (Ch: "outlet should not ask
  // latitude and longitude").
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

/**
 * Ch.6 Outlet Google Business Profile linkage — fetches once immediately
 * (so the admin sees the real name/photo/reviews right after picking,
 * not after waiting for the next cron sweep) and stores the result. The
 * periodic sweep (google-reviews-sweep.ts) keeps it fresh after that.
 */
const linkGooglePlace = createApiRoute<undefined, unknown, z.infer<typeof bodySchema>, RouteParams>(
  {
    bodySchema,
    handler: async ({ body, params }) => {
      const actor = await requireAdmin();
      const admin = createSupabaseAdminClient();

      let details;
      try {
        details = await fetchGooglePlaceDetails(body.placeId);
      } catch (cause) {
        return err(
          new InfrastructureError('Failed to fetch details from Google Places.', {
            cause: cause instanceof Error ? cause.message : String(cause),
          }),
        );
      }

      const { error } = await admin
        .from('outlets')
        .update({
          google_place_id: body.placeId,
          google_business_name: details.name,
          google_cover_photo_url: details.coverPhotoUrl,
          google_rating: details.rating,
          google_rating_count: details.ratingCount,
          google_reviews: details.reviews,
          google_reviews_fetched_at: new Date().toISOString(),
          ...(body.lat != null && body.lng != null
            ? { latitude: body.lat, longitude: body.lng }
            : {}),
        })
        .eq('id', params.id);

      if (error) {
        return err(
          new InfrastructureError('Failed to save Google Business link.', { cause: error.message }),
        );
      }

      await recordAuditEvent({
        eventType: 'outlet.google_place_linked',
        aggregateType: 'outlet',
        aggregateId: params.id,
        actor,
        service: 'outlets',
        next: { placeId: body.placeId, name: details.name },
      });

      return ok(details);
    },
  },
);

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return linkGooglePlace(request, await context.params);
}
