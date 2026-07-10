import { err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/** Ch.16 §110 User & Role Management API — GET (list, with roles joined). */
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().datetime().optional(),
});

const listUsers = createApiRoute({
  querySchema,
  handler: async ({ query }) => {
    const admin = createSupabaseAdminClient();
    let dbQuery = admin
      .from('users')
      .select(
        'id, email, phone, full_name, status, last_login_at, created_at, user_roles(roles(name))',
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(query.limit);
    if (query.cursor) dbQuery = dbQuery.lt('created_at', query.cursor);

    const { data, error } = await dbQuery;
    if (error) {
      return err(new InfrastructureError('Failed to list users.', { cause: error.message }));
    }

    const items = (data ?? []).map((row) => ({
      ...row,
      roles: (row.user_roles as unknown as { roles: { name: string } | null }[])
        .map((ur) => ur.roles?.name)
        .filter((name): name is string => name != null),
      user_roles: undefined,
    }));
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
  return listUsers(request);
}
