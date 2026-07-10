import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  productId: string;
}

/** Ch.16 §79: DELETE /api/v1/account/wishlist/{productId} — keyed by product, not the wishlist row's own id. */
const removeFromWishlist = createApiRoute<undefined, { productId: string }, undefined, RouteParams>(
  {
    handler: async ({ params }) => {
      const supabase = await createSupabaseServerClient();
      const customer = await getCurrentCustomer(supabase);
      if (!customer)
        return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('customer_id', customer.id)
        .eq('product_id', params.productId);
      if (error)
        return err(
          new InfrastructureError('Failed to remove from wishlist.', { cause: error.message }),
        );
      return ok({ productId: params.productId });
    },
  },
);

export async function DELETE(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return removeFromWishlist(request, await context.params);
}
