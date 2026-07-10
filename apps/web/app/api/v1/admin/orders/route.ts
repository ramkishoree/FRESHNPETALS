import { ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createApiRoute } from '@/server/http/route-handler';
import { SupabaseOrderRepository } from '@/server/repositories/supabase-order-repository';
import { runSecurityChain } from '@/server/security/chain';

/** Ch.16 §97 Order Management API — GET (list, search/filter). */
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().datetime().optional(),
});

const listOrders = createApiRoute({
  querySchema,
  handler: async ({ query }) => {
    const admin = createSupabaseAdminClient();
    const repository = new SupabaseOrderRepository(admin);
    const result = await repository.findMany({
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });
    return ok(result);
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return listOrders(request);
}
