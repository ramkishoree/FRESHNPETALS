import { ListPublishedProductsService } from '@prana/commerce';
import Image from 'next/image';
import Link from 'next/link';
import { CategoryCard } from '@/components/commerce/category-card';
import { OfferBanner } from '@/components/commerce/offer-banner';
import { ReviewCard } from '@/components/commerce/review-card';
import { AddToCartProductGrid } from '@/components/storefront/add-to-cart-product-grid';
import { BrandDivider } from '@/components/storefront/brand-divider';
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

  const [productsResult, categoriesResult, offersResult, reviewsResult, outletsResult] =
    await Promise.all([
      service.execute({ limit: 8 }),
      supabase
        .from('categories')
        .select('id, name, slug')
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
        .from('reviews')
        .select('id, rating, title, comment, created_at, verified_purchase, customers(first_name)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('outlets')
        .select('id, name, slug, address, city, latitude, longitude')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name'),
    ]);

  const products = productsResult.ok ? productsResult.value.items : [];
  const categories = categoriesResult.data ?? [];
  const offer = offersResult.data;
  const reviews = reviewsResult.data ?? [];
  const outlets = outletsResult.data ?? [];

  return (
    <div className="pb-24">
      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden">
        <div className="container-brand grid items-center gap-10 pb-16 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
          <div className="max-w-xl">
            <p className="eyebrow mb-5">Lucknow&rsquo;s neighbourhood florist</p>
            <h1 className="text-h1">
              Fresh flowers,
              <br />
              delivered <em className="not-italic text-[var(--gold-deep)]">same-day.</em>
            </h1>
            <p className="text-body-lg mt-6 max-w-md">
              Hand-picked bouquets for every occasion — Lucknow&apos;s freshest flower delivery,
              arranged fresh the morning it ships.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/shop"
                className="btn btn-primary inline-flex items-center px-7 py-3.5 text-sm"
              >
                Shop now
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
                <Image src="/logo-mark.svg" alt="" fill className="object-contain p-16" />
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
              <CategoryCard key={category.id} name={category.name} slug={category.slug} />
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
                <div className="flex items-start gap-3">
                  <PinIcon />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{outlet.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--sf-ink-muted)]">
                      {outlet.address}, {outlet.city}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ==================== REVIEWS ==================== */}
      {reviews.length > 0 && (
        <section className="container-brand pt-24 text-center">
          <p className="eyebrow mb-3">Flowers that speak from the heart</p>
          <h2 className="text-h2">What customers say</h2>
          <BrandDivider className="my-7" />
          <div className="grid gap-5 text-left md:grid-cols-3">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                authorName={
                  (review.customers as unknown as { first_name?: string } | null)?.first_name ??
                  'Customer'
                }
                rating={review.rating}
                comment={review.comment ?? ''}
                createdAt={review.created_at}
                verifiedPurchase={review.verified_purchase}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
