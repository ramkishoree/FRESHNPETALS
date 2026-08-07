import { createSupabaseServerClient } from '@/lib/supabase/server';
import { GoogleReviewsCarouselClient } from './google-reviews-carousel-client';

interface GoogleReview {
  authorName: string;
  rating: number;
  text: string;
  relativeTime: string;
  profilePhotoUrl: string | null;
}

/**
 * Replaces the on-site product-review display per owner request ("I want
 * all google reviews in a loop every 5 second, remove on site reviews").
 * Reads from the cache outlets.google_reviews (populated by the admin
 * Google Business linkage + refreshed by google-reviews-sweep.ts) rather
 * than calling the Places API on render — real API cost otherwise.
 * Renders nothing if no outlet has been linked yet.
 */
export async function GoogleReviewsCarousel() {
  const supabase = await createSupabaseServerClient();
  const { data: outlet } = await supabase
    .from('outlets')
    .select('google_business_name, google_rating, google_rating_count, google_reviews')
    .not('google_place_id', 'is', null)
    .eq('is_active', true)
    .is('deleted_at', null)
    // The owner picks which shop speaks for the brand. This used to take
    // whichever linked outlet had the most reviews, which is how a
    // wrongly-linked business with 101 reviews displaced the real shop's
    // 15 and published a stranger's reputation as ours.
    .eq('show_google_reviews', true)
    .order('google_rating_count', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const reviews = (outlet?.google_reviews as GoogleReview[] | undefined) ?? [];
  if (!outlet || reviews.length === 0) return null;

  return (
    <GoogleReviewsCarouselClient
      businessName={outlet.google_business_name}
      rating={outlet.google_rating}
      ratingCount={outlet.google_rating_count}
      reviews={reviews}
    />
  );
}
