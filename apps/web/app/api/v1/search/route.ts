import { err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sanitizeForPostgrestFilter } from '@/lib/postgrest-filter';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/** Ch.12 §18 Search Experience — "Product Search, Category Search, Blog Search... <200ms." Uses the GIN full-text index on products(name, description) (migration 0005) rather than ILIKE. */
const querySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const search = createApiRoute({
  querySchema,
  handler: async ({ query }) => {
    const supabase = await createSupabaseServerClient();
    const safeQuery = sanitizeForPostgrestFilter(query.q);
    if (!safeQuery) return ok({ products: [], categories: [], blogs: [] });

    const [productsResult, categoriesResult, blogsResult] = await Promise.all([
      supabase
        .from('products')
        .select('id, slug, name, featured_image, product_prices(base_price, sale_price)')
        .eq('status', 'published')
        .textSearch('name', safeQuery, { type: 'websearch', config: 'english' })
        .limit(query.limit),
      supabase
        .from('categories')
        .select('id, slug, name')
        .eq('is_active', true)
        .ilike('name', `%${safeQuery}%`)
        .limit(5),
      supabase
        .from('blogs')
        .select('id, slug, title, featured_image')
        .eq('status', 'published')
        .ilike('title', `%${safeQuery}%`)
        .limit(5),
    ]);

    for (const result of [productsResult, categoriesResult, blogsResult]) {
      if (result.error) {
        return err(new InfrastructureError('Search failed.', { cause: result.error.message }));
      }
    }

    return ok({
      products: productsResult.data ?? [],
      categories: categoriesResult.data ?? [],
      blogs: blogsResult.data ?? [],
    });
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'anonymous' });
  if (blocked) return blocked;
  return search(request);
}
