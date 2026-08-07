import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/** Ch.16 §80 Review API. "Verified Purchase Required" (Ch.8 §115) — checked here; RLS only enforces ownership, not purchase history. */
const createSchema = z.object({
  productId: zUuid(),
  orderId: zUuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(160).optional(),
  comment: z.string().max(2000).optional(),
});

const listOwnReviews = createApiRoute({
  handler: async () => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { data, error } = await supabase
      .from('reviews')
      .select('id, product_id, rating, title, comment, status, verified_purchase, created_at')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });
    if (error)
      return err(new InfrastructureError('Failed to load reviews.', { cause: error.message }));
    return ok(data ?? []);
  },
});

const createReview = createApiRoute({
  bodySchema: createSchema,
  handler: async ({ body }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { data: order } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', body.orderId)
      .eq('customer_id', customer.id)
      .in('status', ['delivered', 'completed'])
      .maybeSingle();
    if (!order) {
      return err(
        new BusinessRuleError('A review requires a delivered order containing this product.', {
          httpStatus: 403,
        }),
      );
    }

    const { data: item } = await supabase
      .from('order_items')
      .select('id')
      .eq('order_id', body.orderId)
      .eq('product_id', body.productId)
      .maybeSingle();
    if (!item) {
      return err(
        new BusinessRuleError('A review requires a delivered order containing this product.', {
          httpStatus: 403,
        }),
      );
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        customer_id: customer.id,
        product_id: body.productId,
        order_id: body.orderId,
        rating: body.rating,
        title: body.title,
        comment: body.comment,
        verified_purchase: true,
        // Auto-approved at the owner's request, now that the Reviews
        // moderation tab is gone: a queue nobody can reach would mean
        // every review sat unpublished forever. Only customers with a
        // delivered order for this product can post one (checked above),
        // so this isn't open to drive-by spam — but it does mean a
        // negative review publishes without review.
        status: 'approved',
      })
      .select()
      .single();
    if (error)
      return err(new InfrastructureError('Failed to create review.', { cause: error.message }));
    return ok(data);
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return listOwnReviews(request);
}

export async function POST(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return createReview(request);
}
