import { ListPublishedProductsService } from '@prana/commerce';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createApiRoute } from '@/server/http/route-handler';
import { SupabaseProductRepository } from '@/server/repositories/supabase-product-repository';
import { runSecurityChain } from '@/server/security/chain';

/**
 * GET /api/v1/products — public product listing. The one working vertical
 * slice through every Ch.11 layer (security chain → validation → app
 * service → repository → Postgres → envelope), proving the pattern the
 * rest of Phase 8/9/10's endpoints will repeat.
 */
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().datetime().optional(),
});

const listProducts = createApiRoute({
  querySchema,
  handler: async ({ query }) => {
    const supabase = await createSupabaseServerClient();
    const repository = new SupabaseProductRepository(supabase);
    const service = new ListPublishedProductsService(repository);
    return service.execute({
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'anonymous' });
  if (blocked) return blocked;
  return listProducts(request);
}
