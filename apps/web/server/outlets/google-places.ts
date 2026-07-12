import 'server-only';
import { getServerEnv } from '@/config/env';
import { logger } from '@/server/logger';

export interface GooglePlaceReview {
  authorName: string;
  rating: number;
  text: string;
  relativeTime: string;
  profilePhotoUrl: string | null;
}

export interface GooglePlaceDetails {
  name: string;
  coverPhotoUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  reviews: GooglePlaceReview[];
}

interface PlaceDetailsApiResponse {
  status: string;
  error_message?: string;
  result?: {
    name: string;
    rating?: number;
    user_ratings_total?: number;
    photos?: { photo_reference: string }[];
    reviews?: {
      author_name: string;
      rating: number;
      text: string;
      relative_time_description: string;
      profile_photo_url?: string;
    }[];
  };
}

function resolveApiKey(): string | undefined {
  const env = getServerEnv();
  return env.GOOGLE_MAPS_API_KEY ?? env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

/** Resolves a Places photo_reference to a real, stable image URL by
 * following the Photo endpoint's redirect server-side once, rather than
 * storing the photo_reference itself (those expire/rotate). */
async function resolvePhotoUrl(photoReference: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(photoReference)}&key=${apiKey}`,
      { redirect: 'follow' },
    );
    return response.ok ? response.url : null;
  } catch (cause) {
    logger.warn('google_places.photo_resolve_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return null;
  }
}

/**
 * Ch.6 Outlet Google Business Profile linkage. Capped at 5 reviews —
 * that's the Places API's own hard limit (Place Details never returns
 * more, regardless of how many reviews the business actually has), not a
 * choice made here.
 */
export async function fetchGooglePlaceDetails(placeId: string): Promise<GooglePlaceDetails> {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error(
      'No Google Maps API key configured (GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).',
    );
  }

  const fields = 'name,rating,user_ratings_total,photos,reviews';
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${apiKey}`,
  );
  const body = (await response.json()) as PlaceDetailsApiResponse;

  if (body.status !== 'OK' || !body.result) {
    throw new Error(`Places API returned ${body.status}: ${body.error_message ?? 'no result'}`);
  }

  const firstPhoto = body.result.photos?.[0];
  const coverPhotoUrl = firstPhoto
    ? await resolvePhotoUrl(firstPhoto.photo_reference, apiKey)
    : null;

  return {
    name: body.result.name,
    coverPhotoUrl,
    rating: body.result.rating ?? null,
    ratingCount: body.result.user_ratings_total ?? null,
    reviews: (body.result.reviews ?? []).slice(0, 5).map((review) => ({
      authorName: review.author_name,
      rating: review.rating,
      text: review.text,
      relativeTime: review.relative_time_description,
      profilePhotoUrl: review.profile_photo_url ?? null,
    })),
  };
}
