import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { stripUndefined } from '@/lib/strip-undefined';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
}

/** Ch.16 §80: "Edit within configurable period" — RLS's `reviews_update_own_pending` policy IS that window: editable only while still `pending` moderation, not a fixed day count. A rejected/approved review's UPDATE silently affects 0 rows here rather than a 403, matching Postgres RLS's usual "no matching row" semantics. */
const patchSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().max(160).optional(),
  comment: z.string().max(2000).optional(),
});

const updateReview = createApiRoute<undefined, unknown, z.infer<typeof patchSchema>, RouteParams>({
  bodySchema: patchSchema,
  handler: async ({ body, params }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { data, error } = await supabase
      .from('reviews')
      .update(stripUndefined(body))
      .eq('id', params.id)
      .eq('customer_id', customer.id)
      .select()
      .maybeSingle();
    if (error)
      return err(new InfrastructureError('Failed to update review.', { cause: error.message }));
    if (!data) {
      return err(
        new BusinessRuleError('This review can no longer be edited (already moderated).', {
          httpStatus: 409,
        }),
      );
    }
    return ok(data);
  },
});

const deleteReview = createApiRoute<undefined, { id: string }, undefined, RouteParams>({
  handler: async ({ params }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { error } = await supabase
      .from('reviews')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('customer_id', customer.id);
    if (error)
      return err(new InfrastructureError('Failed to delete review.', { cause: error.message }));
    return ok({ id: params.id });
  },
});

export async function PATCH(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return updateReview(request, await context.params);
}

export async function DELETE(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return deleteReview(request, await context.params);
}
