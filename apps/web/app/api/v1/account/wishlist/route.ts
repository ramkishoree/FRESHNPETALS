import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/** Ch.16 §79 Wishlist API + Ch.12 §32. */
const WISHLIST_MAX_SIZE = 200;

const createSchema = z.object({ productId: zUuid() });

const listWishlist = createApiRoute({
  handler: async () => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { data, error } = await supabase
      .from('wishlists')
      .select(
        'id, created_at, products(id, slug, name, featured_image, status, product_prices(base_price, sale_price))',
      )
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });
    if (error)
      return err(new InfrastructureError('Failed to load wishlist.', { cause: error.message }));
    return ok(data ?? []);
  },
});

const addToWishlist = createApiRoute({
  bodySchema: createSchema,
  handler: async ({ body }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { count } = await supabase
      .from('wishlists')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customer.id);
    if ((count ?? 0) >= WISHLIST_MAX_SIZE) {
      return err(new BusinessRuleError(`Wishlist is limited to ${WISHLIST_MAX_SIZE} products.`));
    }

    const { data, error } = await supabase
      .from('wishlists')
      .upsert(
        { customer_id: customer.id, product_id: body.productId },
        { onConflict: 'customer_id,product_id', ignoreDuplicates: true },
      )
      .select()
      .maybeSingle();
    if (error)
      return err(new InfrastructureError('Failed to add to wishlist.', { cause: error.message }));
    return ok(data ?? { customer_id: customer.id, product_id: body.productId });
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return listWishlist(request);
}

export async function POST(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return addToWishlist(request);
}
