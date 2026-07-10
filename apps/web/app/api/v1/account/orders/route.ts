import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
  'failed',
  'refunded',
] as const;

/** Ch.16 §77 Order History API. */
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().datetime().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
});

const listOrders = createApiRoute({
  querySchema,
  handler: async ({ query }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    let dbQuery = supabase
      .from('orders')
      .select(
        'id, order_number, status, grand_total, currency, created_at, order_items(product_name, quantity)',
      )
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(query.limit);

    if (query.status) dbQuery = dbQuery.eq('status', query.status);
    if (query.cursor) dbQuery = dbQuery.lt('created_at', query.cursor);

    const { data, error } = await dbQuery;
    if (error)
      return err(new InfrastructureError('Failed to load orders.', { cause: error.message }));

    const items = data ?? [];
    const nextCursor =
      items.length === query.limit
        ? ((items.at(-1) as { created_at?: string })?.created_at ?? null)
        : null;
    return ok({ items, nextCursor });
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return listOrders(request);
}
