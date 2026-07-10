import type { Metadata } from 'next';
import { AddToCartProductGrid } from '@/components/storefront/add-to-cart-product-grid';
import { ShopSortControl } from '@/components/storefront/shop-sort-control';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  mapProductRow,
  PRODUCT_SELECT_COLUMNS,
  sortToOrderBy,
} from '@/server/storefront/shop-query';

export const metadata: Metadata = { title: 'Shop All Products | Fresh & Petals' };

/** Ch.12 §19 Category Pages (used here for the unfiltered "shop all" listing too) — SEO header, sorting, product grid, all server-rendered. */
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
    <div className="container-brand space-y-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 text-foreground font-bold">All products</h1>
        <ShopSortControl {...(sort ? { currentSort: sort } : {})} />
      </div>
      <AddToCartProductGrid products={products} />
    </div>
  );
}
