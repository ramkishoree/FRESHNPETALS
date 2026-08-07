import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchGooglePlaceDetails } from './google-places';
import { logger } from '@/server/logger';

const REFRESH_INTERVAL_HOURS = 12;

/** Refreshes cached Google reviews for every outlet with a linked
 * google_place_id whose cache is stale — keeps the on-site carousel
 * current without calling the Places API on every page view. */
export async function sweepGoogleReviews(admin: SupabaseClient): Promise<void> {
  const staleBefore = new Date(Date.now() - REFRESH_INTERVAL_HOURS * 60 * 60 * 1000).toISOString();

  const { data: outlets, error } = await admin
    .from('outlets')
    .select('id, google_place_id, google_reviews_fetched_at')
    .not('google_place_id', 'is', null)
    .or(`google_reviews_fetched_at.is.null,google_reviews_fetched_at.lt.${staleBefore}`);

  if (error) {
    logger.error('worker.google_reviews_sweep_failed', { message: error.message });
    return;
  }

  let refreshed = 0;
  for (const outlet of outlets ?? []) {
    try {
      const details = await fetchGooglePlaceDetails(outlet.google_place_id as string);
      await admin
        .from('outlets')
        .update({
          google_business_name: details.name,
          google_cover_photo_url: details.coverPhotoUrl,
          google_rating: details.rating,
          google_rating_count: details.ratingCount,
          google_reviews: details.reviews,
          google_reviews_fetched_at: new Date().toISOString(),
        })
        .eq('id', outlet.id as string);
      refreshed++;
    } catch (cause) {
      logger.error('worker.google_reviews_sweep.outlet_failed', {
        outletId: outlet.id,
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  if (refreshed > 0) {
    logger.info('worker.google_reviews_sweep.completed', { refreshed });
  }
}
