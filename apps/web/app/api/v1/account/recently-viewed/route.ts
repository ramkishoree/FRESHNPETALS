import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/**
 * Ch.16 §82 Recently Viewed API (GET only in the spec) + Ch.12 §33
 * ("Logged In: Database"). POST isn't in Ch.16's list but has to exist
 * somewhere for a logged-in customer's view history to ever get written
 * — the product detail page (client-side) calls it on mount. Guests use
 * localStorage entirely client-side, per the same section, so they never
 * hit this route at all.
 */
const RECENTLY_VIEWED_MAX = 20;

const recordSchema = z.object({ productId: zUuid() });

const listRecentlyViewed = createApiRoute({
  handler: async () => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { data, error } = await supabase
      .from('recently_viewed')
      .select(
        'viewed_at, products(id, slug, name, featured_image, status, product_prices(base_price, sale_price))',
      )
      .eq('customer_id', customer.id)
      .order('viewed_at', { ascending: false })
      .limit(RECENTLY_VIEWED_MAX);
    if (error) {
      return err(
        new InfrastructureError('Failed to load recently viewed products.', {
          cause: error.message,
        }),
      );
    }
    return ok(data ?? []);
  },
});

const recordView = createApiRoute({
  bodySchema: recordSchema,
  handler: async ({ body }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { error } = await supabase.from('recently_viewed').upsert(
      {
        customer_id: customer.id,
        product_id: body.productId,
        viewed_at: new Date().toISOString(),
      },
      { onConflict: 'customer_id,product_id' },
    );
    if (error)
      return err(new InfrastructureError('Failed to record view.', { cause: error.message }));
    return ok({ productId: body.productId });
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return listRecentlyViewed(request);
}

export async function POST(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return recordView(request);
}
