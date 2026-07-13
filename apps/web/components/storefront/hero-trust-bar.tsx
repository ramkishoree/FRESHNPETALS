import { createSupabaseServerClient } from '@/lib/supabase/server';
import { HeroTrustBarClient } from './hero-trust-bar-client';

interface GoogleReview {
  authorName: string;
  rating: number;
  text: string;
}

/**
 * Owner's explicit call: reviews should be "among the first things seen
 * on mobile and laptop... it should look like there are already
 * customers" — this sits above the hero eyebrow/tagline, before the
 * full GoogleReviewsCarousel further down the page. Same
 * outlets.google_reviews cache as that carousel (no extra Places API
 * cost), just a compact glanceable strip rather than the full
 * photo+paragraph card.
 */
export async function HeroTrustBar() {
  const supabase = await createSupabaseServerClient();
  const { data: outlet } = await supabase
    .from('outlets')
    .select('google_rating, google_rating_count, google_reviews')
    .not('google_place_id', 'is', null)
    .eq('is_active', true)
    .order('google_rating_count', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const reviews = (outlet?.google_reviews as GoogleReview[] | undefined) ?? [];
  if (!outlet || reviews.length === 0) return null;

  return (
    <HeroTrustBarClient
      rating={outlet.google_rating}
      ratingCount={outlet.google_rating_count}
      reviews={reviews}
    />
  );
}
