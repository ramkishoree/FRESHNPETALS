import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchGooglePlaceDetails, searchGooglePlace } from './google-places';
import { logger } from '@/server/logger';

const REFRESH_INTERVAL_HOURS = 12;

/** Refreshes cached Google reviews for every outlet with a linked
 * google_place_id whose cache is stale — keeps the on-site carousel
 * current without calling the Places API on every page view. */
export async function sweepGoogleReviews(admin: SupabaseClient): Promise<void> {
  await resolvePendingPlaceLinks(admin);

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

/**
 * Outlets the owner asked to link before Google had indexed them.
 *
 * A new Google Business listing is visible in Search and Maps well
 * before the Places API knows about it, so there is no `place_id` to
 * pick at the moment the shop opens. Rather than making the owner come
 * back and try again every few days, the query they typed is stored and
 * retried here on every sweep — the outlet links itself the day Google
 * catches up, and the details are then filled in by the refresh pass
 * that follows immediately after.
 *
 * Failures are silent on purpose: "still not indexed" is the expected
 * answer for a new shop, not something to alarm anyone with.
 */
async function resolvePendingPlaceLinks(admin: SupabaseClient): Promise<void> {
  const { data: pending, error } = await admin
    .from('outlets')
    .select('id, google_place_query')
    .is('google_place_id', null)
    .not('google_place_query', 'is', null);

  if (error || !pending || pending.length === 0) return;

  for (const outlet of pending) {
    try {
      const placeId = await searchGooglePlace(outlet.google_place_query as string);
      if (!placeId) continue;

      // Clearing the query is what stops this retrying forever, and is
      // also the signal the admin reads to stop showing "waiting".
      await admin
        .from('outlets')
        .update({ google_place_id: placeId, google_place_query: null })
        .eq('id', outlet.id as string);

      logger.info('worker.google_place_link_resolved', {
        outletId: outlet.id as string,
        placeId,
      });
    } catch (cause) {
      logger.warn('worker.google_place_link_retry_failed', {
        outletId: outlet.id as string,
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }
}
