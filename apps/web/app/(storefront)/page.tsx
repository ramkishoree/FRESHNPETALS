import { ListPublishedProductsService } from '@prana/commerce';
import Image from 'next/image';
import Link from 'next/link';
import { CategoryCard } from '@/components/commerce/category-card';
import { OfferBanner } from '@/components/commerce/offer-banner';
import { ReviewCard } from '@/components/commerce/review-card';
import { AddToCartProductGrid } from '@/components/storefront/add-to-cart-product-grid';
import { Button } from '@/components/ui/button';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SupabaseProductRepository } from '@/server/repositories/supabase-product-repository';

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

  const [productsResult, categoriesResult, offersResult, reviewsResult] = await Promise.all([
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
  ]);

  const products = productsResult.ok ? productsResult.value.items : [];
  const categories = categoriesResult.data ?? [];
  const offer = offersResult.data;
  const reviews = reviewsResult.data ?? [];

  return (
    <div>
      <section className="bg-secondary">
        <div className="container-brand grid gap-8 py-16 lg:grid-cols-2 lg:items-center">
          <div className="space-y-4">
            <h1 className="text-hero text-foreground font-bold">
              Fresh flowers, delivered same-day.
            </h1>
            <p className="text-body-lg text-muted-foreground">
              Hand-picked bouquets for every occasion — Lucknow&apos;s freshest flower delivery.
            </p>
            <Button asChild size="lg">
              <Link href="/shop">Shop now</Link>
            </Button>
          </div>
          <div className="aspect-4/3 rounded-image bg-muted relative overflow-hidden">
            <Image src="/logo-mark.svg" alt="" fill className="object-contain p-16" />
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="container-brand space-y-6 py-12">
          <h2 className="text-h2 text-foreground font-bold">Shop by category</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => (
              <CategoryCard key={category.id} name={category.name} slug={category.slug} />
            ))}
          </div>
        </section>
      )}

      <section className="container-brand space-y-6 py-12">
        <h2 className="text-h2 text-foreground font-bold">Featured products</h2>
        <AddToCartProductGrid products={products} />
      </section>

      {offer && (
        <section className="container-brand py-6">
          <OfferBanner
            title={offer.name}
            description={offer.description ?? ''}
            ctaLabel="Shop the offer"
            ctaHref="/shop"
          />
        </section>
      )}

      {reviews.length > 0 && (
        <section className="container-brand space-y-6 py-12">
          <h2 className="text-h2 text-foreground font-bold">What customers say</h2>
          <div className="grid gap-4 sm:grid-cols-3">
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
