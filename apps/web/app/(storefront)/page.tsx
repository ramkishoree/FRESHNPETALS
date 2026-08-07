import type { Metadata } from 'next';
import { OfferBanner } from '@/components/commerce/offer-banner';
import { AddToCartProductGrid } from '@/components/storefront/add-to-cart-product-grid';
import { FloatingCategoryBar } from '@/components/storefront/floating-category-bar';
import { OfferBadge } from '@/components/storefront/offer-badge';
import { ShopSortControl } from '@/components/storefront/shop-sort-control';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  mapProductRow,
  PRODUCT_SELECT_COLUMNS,
  sortProducts,
  sortToOrderBy,
} from '@/server/storefront/shop-query';

export const metadata: Metadata = {
  title: 'Fresh & Petals — Flowers, bouquets & gifts',
  description:
    'Every bloom, box and bouquet we make, delivered fresh across Lucknow. Browse the full catalogue and order in a couple of taps.',
};

/**
 * Owner's explicit call: the products ARE the landing page. No hero, no
 * tagline block, no brand statement — the catalogue starts within the
 * first screen and everything is on one page rather than paginated.
 * Category pills scope to the existing `/shop/[category]` pages.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { column, ascending } = sortToOrderBy(sort);

  const [productsResult, categoriesResult, offerResult] = await Promise.all([
    supabase
      .from('products')
      .select(PRODUCT_SELECT_COLUMNS)
      .eq('status', 'published')
      .order(column, { ascending }),
    supabase
      .from('categories')
      .select('name, slug')
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
  ]);

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

      <FloatingCategoryBar categories={categories} />

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
