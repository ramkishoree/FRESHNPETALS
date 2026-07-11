import { ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createApiRoute } from '@/server/http/route-handler';
import { AdminCrudRepository } from '@/server/repositories/admin-crud-repository';
import { runSecurityChain } from '@/server/security/chain';

/**
 * Ch.16 §99 Review Moderation API — read-only listing (no POST: customers
 * create reviews via the storefront, Phase 9; administrators only
 * moderate). `review_status` (Ch.10 §2) has three values — pending,
 * approved, rejected; Ch.6's "Reported/Hidden" moderation states aren't
 * backed by a column yet, so this exposes exactly what the schema
 * supports today rather than a UI for states that don't persist anywhere.
 */
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().datetime().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  product_id: zUuid().optional(),
});

const listReviews = createApiRoute({
  querySchema,
  handler: async ({ query }) => {
    const admin = createSupabaseAdminClient();
    const repository = new AdminCrudRepository(admin, 'reviews');
    const filters: Record<string, string> = {};
    if (query.status) filters['status'] = query.status;
    if (query.product_id) filters['product_id'] = query.product_id;

    const result = await repository.list({
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      filters,
    });
    return ok(result);
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return listReviews(request);
}
