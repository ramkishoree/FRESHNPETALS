import type { Metadata } from 'next';
import { AddToCartProductGrid } from '@/components/storefront/add-to-cart-product-grid';
import { BrandDivider } from '@/components/storefront/brand-divider';
import { Reveal } from '@/components/storefront/reveal';
import { ShopSortControl } from '@/components/storefront/shop-sort-control';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  mapProductRow,
  PRODUCT_SELECT_COLUMNS,
  sortToOrderBy,
} from '@/server/storefront/shop-query';

export const metadata: Metadata = { title: 'Shop All Products | Fresh & Petals' };

/** Ch.12 §19 Category Pages (used here for the unfiltered "shop all" listing too). */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { column, ascending } = sortToOrderBy(sort);

  const { data } = await supabase
    .from('products')
    .select(PRODUCT_SELECT_COLUMNS)
    .eq('status', 'published')
    .order(column, { ascending })
    .limit(48);

  const products = (data ?? []).map(mapProductRow);

  return (
    <div className="container-brand py-14">
      <header className="hero-in text-center">
        <p className="eyebrow mb-3">The whole shop</p>
        <h1 className="text-h1">Every bloom, box &amp; bouquet</h1>
        <BrandDivider className="mt-6" />
      </header>

      <Reveal>
        <div className="mt-10 mb-6 flex items-center justify-between gap-4">
          <p className="text-caption">
            {products.length} {products.length === 1 ? 'item' : 'items'}
          </p>
          <ShopSortControl {...(sort ? { currentSort: sort } : {})} />
        </div>

        <AddToCartProductGrid products={products} />
      </Reveal>
    </div>
  );
}
