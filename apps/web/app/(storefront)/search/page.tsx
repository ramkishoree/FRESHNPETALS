import Link from 'next/link';
import { AddToCartProductGrid } from '@/components/storefront/add-to-cart-product-grid';
import { EmptyState } from '@/components/states/empty-state';
import { mapProductRow, PRODUCT_SELECT_COLUMNS } from '@/server/storefront/shop-query';
import { sanitizeForPostgrestFilter } from '@/lib/postgrest-filter';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Ch.12 §18 Search Experience. */
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

  const [productsResult, blogsResult] = await Promise.all([
    safeQuery
      ? supabase
          .from('products')
          .select(PRODUCT_SELECT_COLUMNS)
          .eq('status', 'published')
          .textSearch('name', safeQuery, { type: 'websearch', config: 'english' })
          .limit(24)
      : Promise.resolve({ data: [] as never[] }),
    safeQuery
      ? supabase
          .from('blogs')
          .select('id, slug, title')
          .eq('status', 'published')
          .is('deleted_at', null)
          .ilike('title', `%${safeQuery}%`)
          .limit(5)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const products = (productsResult.data ?? []).map(mapProductRow);
  const blogs = blogsResult.data ?? [];

  return (
    <div className="container-brand space-y-8 py-10">
      <h1 className="text-h2 text-foreground font-bold">Search results for &quot;{query}&quot;</h1>

      {products.length === 0 && blogs.length === 0 ? (
        <EmptyState title="No results found" description="Try a different search term." />
      ) : (
        <>
          {products.length > 0 && <AddToCartProductGrid products={products} />}
          {blogs.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-h4 text-foreground font-semibold">Blog articles</h2>
              <ul className="space-y-1">
                {blogs.map((blog) => (
                  <li key={blog.id}>
                    <Link
                      href={`/blog/${blog.slug}`}
                      className="text-body text-primary hover:underline"
                    >
                      {blog.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
