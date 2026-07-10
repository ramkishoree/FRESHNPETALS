import { err, InfrastructureError, ok, BusinessRuleError } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  slug: string;
}

/** Ch.12 §22 Product Detail Page — "must be server-rendered for SEO." This route backs client-side re-fetches (e.g. variant switches); the page itself (app/product/[slug]/page.tsx) queries Supabase directly as a Server Component for the first paint. */
const getProduct = createApiRoute<undefined, unknown, undefined, RouteParams>({
  handler: async ({ params }) => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('products')
      .select(
        'id, sku, slug, name, short_description, description, featured_image, seo_title, meta_description, status, category_id, categories(name, slug), product_prices(base_price, sale_price), reviews(rating, status)',
      )
      .eq('slug', params.slug)
      .eq('status', 'published')
      .maybeSingle();

    if (error)
      return err(new InfrastructureError('Failed to load product.', { cause: error.message }));
    if (!data) return err(new BusinessRuleError('Product not found.', { httpStatus: 404 }));
    return ok(data);
  },
});

export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'anonymous' });
  if (blocked) return blocked;
  return getProduct(request, await context.params);
}
