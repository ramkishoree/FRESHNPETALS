import { AddToCartProductGrid } from '@/components/storefront/add-to-cart-product-grid';
import { EmptyState } from '@/components/states/empty-state';
import { mapProductRow, PRODUCT_SELECT_COLUMNS } from '@/server/storefront/shop-query';
import { sanitizeForPostgrestFilter } from '@/lib/postgrest-filter';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Ch.12 §18 Search Experience — products only, now that the blog is gone. */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  if (!query) {
    return (
      <div className="container-brand py-16">
        <EmptyState title="Search for flowers, gifts, and occasions" />
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const safeQuery = sanitizeForPostgrestFilter(query);

  const { data } = safeQuery
    ? await supabase
        .from('products')
        .select(PRODUCT_SELECT_COLUMNS)
        .eq('status', 'published')
        .textSearch('name', safeQuery, { type: 'websearch', config: 'english' })
        .limit(24)
    : { data: [] as never[] };

  const products = (data ?? []).map(mapProductRow);

  return (
    <div className="container-brand space-y-8 py-10">
      <h1 className="text-h2 text-foreground font-bold">Search results for &quot;{query}&quot;</h1>

      {products.length === 0 ? (
        <EmptyState title="No results found" description="Try a different search term." />
      ) : (
        <AddToCartProductGrid products={products} />
      )}
    </div>
  );
}
