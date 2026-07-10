import { err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
}

const revokeSession = createApiRoute<undefined, { id: string }, undefined, RouteParams>({
  handler: async ({ params }) => {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('user_id', user?.id ?? '');
    if (error)
      return err(new InfrastructureError('Failed to revoke session.', { cause: error.message }));
    return ok({ id: params.id });
  },
});

export async function DELETE(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return revokeSession(request, await context.params);
}
