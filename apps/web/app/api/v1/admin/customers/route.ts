import { err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sanitizeForPostgrestFilter } from '@/lib/postgrest-filter';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/** Ch.16 §98 Customer Management API — GET (list). */
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().datetime().optional(),
  search: z.string().min(1).max(200).optional(),
});

const listCustomers = createApiRoute({
  querySchema,
  handler: async ({ query }) => {
    const admin = createSupabaseAdminClient();
    let dbQuery = admin
      .from('customers')
      .select(
        'id, first_name, last_name, email, phone, lifetime_value, total_orders, average_order_value, status, marketing_opt_in, created_at',
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(query.limit);

    if (query.cursor) dbQuery = dbQuery.lt('created_at', query.cursor);
    if (query.search) {
      const safe = sanitizeForPostgrestFilter(query.search);
      if (safe)
        dbQuery = dbQuery.or(
          `email.ilike.%${safe}%,first_name.ilike.%${safe}%,last_name.ilike.%${safe}%`,
        );
    }

    const { data, error } = await dbQuery;
    if (error)
      return err(new InfrastructureError('Failed to list customers.', { cause: error.message }));

    const items = data ?? [];
    const nextCursor =
      items.length === query.limit
        ? ((items.at(-1) as { created_at?: string })?.created_at ?? null)
        : null;
    return ok({ items, nextCursor });
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return listCustomers(request);
}
