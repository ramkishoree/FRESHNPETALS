import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AddToCartProductGrid } from '@/components/storefront/add-to-cart-product-grid';
import { FloatingCategoryBar } from '@/components/storefront/floating-category-bar';
import { ShopSortControl } from '@/components/storefront/shop-sort-control';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  mapProductRow,
  PRODUCT_SELECT_COLUMNS,
  sortToOrderBy,
} from '@/server/storefront/shop-query';

interface PageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ sort?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('categories')
    .select('name')
    .eq('slug', category)
    .maybeSingle();
  return { title: data ? `${data.name} | Fresh & Petals` : 'Fresh & Petals' };
}

/** Ch.12 §19 Category Pages. */
export default async function CategoryShopPage({ params, searchParams }: PageProps) {
  const { category: categorySlug } = await params;
  const { sort } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: category } = await supabase
    .from('categories')
    .select('id, name, slug, description')
    .eq('slug', categorySlug)
    .eq('is_active', true)
    .maybeSingle();
  if (!category) notFound();

  const { column, ascending } = sortToOrderBy(sort);
  const { data } = await supabase
    .from('products')
    .select(PRODUCT_SELECT_COLUMNS)
    .eq('status', 'published')
    .eq('category_id', category.id)
    .order(column, { ascending })
    .limit(48);

  const products = (data ?? []).map(mapProductRow);

  // Same pill bar as the catalogue landing page, so switching category —
  // or getting back to "All" — never requires the browser back button.
  const { data: categories } = await supabase
    .from('categories')
    .select('name, slug')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });

  return (
    <div className="container-brand py-6 pb-20">
      <FloatingCategoryBar categories={categories ?? []} />

      <div className="mt-6 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-h4 text-foreground font-semibold">{category.name}</h1>
          {category.description && (
            <p className="text-caption text-muted-foreground">{category.description}</p>
          )}
        </div>
        <ShopSortControl {...(sort ? { currentSort: sort } : {})} />
      </div>
      <AddToCartProductGrid products={products} />
    </div>
  );
}
