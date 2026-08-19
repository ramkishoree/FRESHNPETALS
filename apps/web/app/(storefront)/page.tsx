import type { Metadata } from 'next';
import { OfferBanner } from '@/components/commerce/offer-banner';
import { AddToCartProductGrid } from '@/components/storefront/add-to-cart-product-grid';
import { CategoryAvatarStrip } from '@/components/storefront/category-avatar-strip';
import { HeroCarousel } from '@/components/storefront/hero-carousel';
import { OfferBadge } from '@/components/storefront/offer-badge';
import { ShopSortControl } from '@/components/storefront/shop-sort-control';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchHeroSlides } from '@/server/storefront/hero-slides';
import { logger } from '@/server/logger';
import {
  mapProductRow,
  PRODUCT_SELECT_COLUMNS,
  sortProducts,
  sortToOrderBy,
} from '@/server/storefront/shop-query';

/**
 * `title.absolute` rather than the template: the landing page has to
 * carry the primary local terms itself, and appending the brand suffix a
 * second time would push the useful words past what a result snippet
 * shows.
 */
export const metadata: Metadata = {
  title: {
    absolute: 'Flower Shop in Lucknow | Buy Flowers Online — Fresh N Petals Florist',
  },
  description:
    'Buy flowers online in Lucknow. Fresh bouquets, basket bouquets, chocolate bouquets, indoor plants and gifts from Fresh N Petals, with same-day delivery from our Gomti Nagar and Arjunganj shops.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Flower Shop in Lucknow | Buy Flowers Online — Fresh N Petals',
    description:
      'Fresh bouquets, baskets and gifts delivered across Lucknow the same day, from two shops in Gomti Nagar and Arjunganj.',
    url: '/',
    type: 'website',
  },
};

/**
 * Owner's explicit call: the catalogue starts within the first screen and
 * everything is on one page rather than paginated. The hero above it is
 * a capped band, not a splash — see `.hero-band` for why its height is
 * in pixels rather than viewport units — and it disappears entirely
 * until the owner puts something in a slot.
 *
 * The round category avatars are the only category navigation left; the
 * text pill bar that used to sit under the hero went to the same
 * `/shop/[category]` pages and competed for the same sticky slot.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { column, ascending } = sortToOrderBy();

  const [productsResult, categoriesResult, offerResult, heroSlides] = await Promise.all([
    supabase
      .from('products')
      .select(PRODUCT_SELECT_COLUMNS)
      .eq('status', 'published')
      .order(column, { ascending }),
    supabase
      .from('categories')
      // image_url is the cover photo the category cards already use —
      // the avatar strip crops the same picture rather than asking for
      // a second upload.
      .select('name, slug, image_url')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
    supabase
      .from('offers')
      .select('id, name, tagline, banner_heading, coupon_code, conditions_text, ends_at')
      .eq('active', true)
      .is('deleted_at', null)
      // Only offers still running — an expired promo advertising a dead
      // coupon code is worse than showing nothing.
      .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    fetchHeroSlides(supabase),
  ]);

  // These three follow the same rule the hero learned the hard way: an
  // errored query and an empty table look identical after `?? []`, so a
  // transient failure silently removes a whole section of the page. The
  // fallback stays — half a homepage beats none — but it is recorded now
  // rather than guessed at later.
  if (productsResult.error) {
    logger.error('homepage.products_query_failed', { message: productsResult.error.message });
  }
  if (categoriesResult.error) {
    logger.error('homepage.categories_query_failed', { message: categoriesResult.error.message });
  }
  if (offerResult.error) {
    logger.warn('homepage.offer_query_failed', { message: offerResult.error.message });
  }

  const products = sortProducts((productsResult.data ?? []).map(mapProductRow), sort);
  const categories = categoriesResult.data ?? [];
  const offer = offerResult.data;

  return (
    <div className="container-brand py-6 pb-20">
      {offer && (
        <OfferBadge
          offer={{
            id: offer.id as string,
            // Falls back to the internal name so an offer saved without a
            // tagline still shows something meaningful rather than blank.
            tagline: (offer.tagline as string | null) ?? (offer.name as string),
            bannerHeading: (offer.banner_heading as string | null) ?? null,
            couponCode: (offer.coupon_code as string | null) ?? null,
            conditionsText: (offer.conditions_text as string | null) ?? null,
            endsAt: (offer.ends_at as string | null) ?? null,
          }}
        />
      )}

      {/* A direct child of the page container, so its sticky containing
          block is the whole page and it stays pinned all the way down
          rather than releasing at the bottom of a wrapper. */}
      <CategoryAvatarStrip
        categories={categories.map((category) => ({
          name: category.name as string,
          slug: category.slug as string,
          imageUrl: (category.image_url as string | null) ?? null,
        }))}
      />

      <HeroCarousel slides={heroSlides} />

      <div className="mt-6 mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h4 font-semibold">
          {products.length} {products.length === 1 ? 'product' : 'products'}
        </h1>
        <ShopSortControl {...(sort ? { currentSort: sort } : {})} />
      </div>

      <AddToCartProductGrid products={products} />

      {offer && (
        <section className="pt-16">
          <OfferBanner
            title={(offer.tagline as string | null) ?? (offer.name as string)}
            description={(offer.conditions_text as string | null) ?? ''}
            ctaLabel="Shop the offer"
            ctaHref="/"
          />
        </section>
      )}
    </div>
  );
}
