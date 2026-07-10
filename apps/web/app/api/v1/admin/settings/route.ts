import { err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/** Ch.16 §112 System Configuration API — GET lists every setting (visibility isn't Owner-gated, only editing is). */
const querySchema = z.object({
  category: z
    .enum(['business', 'payment', 'delivery', 'tax', 'seo', 'email', 'ai', 'feature_flags'])
    .optional(),
});

const listSettings = createApiRoute({
  querySchema,
  handler: async ({ query }) => {
    const admin = createSupabaseAdminClient();
    let dbQuery = admin
      .from('system_settings')
      .select('id, key, category, value, description, requires_owner, updated_at')
      .order('category', { ascending: true });
    if (query.category) dbQuery = dbQuery.eq('category', query.category);

    const { data, error } = await dbQuery;
    if (error) {
      return err(new InfrastructureError('Failed to list settings.', { cause: error.message }));
    }
    return ok(data ?? []);
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return listSettings(request);
}
