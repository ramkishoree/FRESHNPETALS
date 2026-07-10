import { err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/** Ch.6 Category Hierarchy — public category list backing the storefront's nav/shop pages. */
const listCategories = createApiRoute({
  handler: async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, description, parent_id, sort_order')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    if (error)
      return err(new InfrastructureError('Failed to load categories.', { cause: error.message }));
    return ok(data ?? []);
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'anonymous' });
  if (blocked) return blocked;
  return listCategories(request);
}
