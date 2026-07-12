import { ListPublishedProductsService } from '@prana/commerce';
import Image from 'next/image';
import Link from 'next/link';
import { CategoryCard } from '@/components/commerce/category-card';
import { OfferBanner } from '@/components/commerce/offer-banner';
import { AddToCartProductGrid } from '@/components/storefront/add-to-cart-product-grid';
import { GoogleReviewsCarousel } from '@/components/storefront/google-reviews-carousel';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SupabaseProductRepository } from '@/server/repositories/supabase-product-repository';

/** Map pin SVG for the outlet list. */
function PinIcon() {
  return (
    <svg
      className="size-4 shrink-0 text-[var(--gold-deep)]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

/**
 * Ch.12 §15 Homepage Structure: Announcement Banner (global, not
 * per-page) → Hero → Categories → Featured Products → Best Sellers →
 * Today's Offers → Why Choose Us → Customer Reviews → Instagram Gallery
 * → Latest Blogs → FAQ → Footer. Instagram Gallery/FAQ are deferred (no
 * Instagram API integration decision made yet, no FAQ content model
 * wired) — every other section is real data, not placeholder markup.
 */
export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const repository = new SupabaseProductRepository(supabase);
  const service = new ListPublishedProductsService(repository);

  const [productsResult, categoriesResult, offersResult, outletsResult, homePageResult] =
    await Promise.all([
      service.execute({ limit: 8 }),
      supabase
        .from('categories')
        .select('id, name, slug, image_url')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .limit(6),
      supabase
        .from('offers')
        .select('id, name, description')
        .eq('active', true)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('outlets')
        .select(
          'id, name, slug, address, city, latitude, longitude, google_business_name, google_rating, google_rating_count, google_cover_photo_url',
        )
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name'),
      supabase.from('static_pages').select('content').eq('slug', 'home').maybeSingle(),
    ]);

  const products = productsResult.ok ? productsResult.value.items : [];
  const categories = categoriesResult.data ?? [];
  const offer = offersResult.data;
  const outlets = outletsResult.data ?? [];

  // Editable via Admin → Pages → the "home" entry's Body content field
  // ({eyebrow, title, titleHighlight, subtitle, ctaLabel, heroImageUrl}).
  // Falls back to the original copy when that row doesn't exist yet or a
  // field is left blank, so this never renders empty hero text.
  interface HomeHeroContent {
    eyebrow?: string;
    title?: string;
    titleHighlight?: string;
    subtitle?: string;
    ctaLabel?: string;
    heroImageUrl?: string;
  }
  const hero = (homePageResult.data?.content as HomeHeroContent | null) ?? {};

  return (
    <div className="pb-24">
      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden">
        <div className="container-brand grid items-center gap-10 pb-16 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
          <div className="max-w-xl">
            <p className="eyebrow mb-5">{hero.eyebrow ?? "Lucknow's neighbourhood florist"}</p>
            <h1 className="text-h1">
              {hero.title ?? 'Fresh flowers, delivered'}{' '}
              <em className="not-italic text-[var(--gold-deep)]">
                {hero.titleHighlight ?? 'same-day.'}
              </em>
            </h1>
            <p className="text-body-lg mt-6 max-w-md">
              {hero.subtitle ??
                "Hand-picked bouquets for every occasion — Lucknow's freshest flower delivery, arranged fresh the morning it ships."}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/shop"
                className="btn btn-primary inline-flex items-center px-7 py-3.5 text-sm"
              >
                {hero.ctaLabel ?? 'Shop now'}
              </Link>
            </div>
          </div>

          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-6 -z-10 rounded-[32px] bg-[radial-gradient(60%_60%_at_60%_30%,rgba(200,162,93,0.18),transparent_70%)]"
            />
            <div className="relative overflow-hidden rounded-[26px] border border-[var(--sf-border)] bg-[var(--sf-surface)] shadow-[var(--shadow-lift)]">
              <div className="relative aspect-[4/5] w-full">
                <Image
                  src={hero.heroImageUrl ?? '/logo-mark.svg'}
                  alt=""
                  fill
                  className={hero.heroImageUrl ? 'object-cover' : 'object-contain p-16'}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== SHOP BY CATEGORY ==================== */}
      {categories.length > 0 && (
        <section className="container-brand pt-4">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">Browse</p>
              <h2 className="text-h3">Shop by category</h2>
            </div>
            <Link
              href="/shop"
              className="text-caption text-[var(--gold-deep)] underline-offset-4 hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                name={category.name}
                slug={category.slug}
                image={category.image_url}
              />
            ))}
          </div>
        </section>
      )}

      {/* ==================== FEATURED PRODUCTS ==================== */}
      <section className="container-brand pt-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Most loved</p>
            <h2 className="text-h2">Featured products</h2>
          </div>
          <Link
            href="/shop"
            className="text-caption text-[var(--gold-deep)] underline-offset-4 hover:underline"
          >
            View all →
          </Link>
        </div>
        <AddToCartProductGrid products={products} />
      </section>

      {/* ==================== OFFER BANNER ==================== */}
      {offer && (
        <section className="container-brand pt-20">
          <OfferBanner
            title={offer.name}
            description={offer.description ?? ''}
            ctaLabel="Shop the offer"
            ctaHref="/shop"
          />
        </section>
      )}

      {/* ==================== OUR OUTLETS ==================== */}
      {outlets.length > 0 && (
        <section className="container-brand pt-20">
          <div className="mb-7 text-center">
            <p className="eyebrow mb-2">We deliver from</p>
            <h2 className="text-h2">Our outlets</h2>
            <p className="text-body mt-3 max-w-md text-[var(--sf-ink-muted)]">
              At checkout, pin your delivery location on the map and pick the nearest outlet — the
              delivery fee is calculated from there.
            </p>
          </div>
          <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {outlets.map((outlet) => (
              <div
                key={outlet.id}
                className="rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4"
              >
                {outlet.google_cover_photo_url && (
                  <div className="relative -mx-1 -mt-1 mb-3 h-24 overflow-hidden rounded-[var(--r-md)]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Google-hosted photo */}
                    <img
                      src={outlet.google_cover_photo_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <PinIcon />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {outlet.google_business_name ?? outlet.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--sf-ink-muted)]">
                      {outlet.address}, {outlet.city}
                    </p>
                    {outlet.google_rating != null && (
                      <p className="mt-1 text-xs font-medium text-[var(--gold-deep)]">
                        {outlet.google_rating}★ on Google
                        {outlet.google_rating_count != null && ` (${outlet.google_rating_count})`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <GoogleReviewsCarousel />
    </div>
  );
}
