import { err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/**
 * Ch.16 §111 Audit Log API — "Date Range, User, Action, Severity,
 * Service... Immutable. Read-only." No PATCH/DELETE exists anywhere in
 * this file, by design (see migration 0023's rationale: `event_store`
 * itself has no admin-facing write policy at all).
 */
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().datetime().optional(),
  actorId: zUuid().optional(),
  service: z.string().optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const listAuditLog = createApiRoute({
  querySchema,
  handler: async ({ query }) => {
    const admin = createSupabaseAdminClient();
    let dbQuery = admin
      .from('event_store')
      .select(
        'id, event_type, aggregate_type, aggregate_id, actor_id, actor_ip, severity, service, payload, correlation_id, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(query.limit);

    if (query.actorId) dbQuery = dbQuery.eq('actor_id', query.actorId);
    if (query.service) dbQuery = dbQuery.eq('service', query.service);
    if (query.severity) dbQuery = dbQuery.eq('severity', query.severity);
    if (query.from) dbQuery = dbQuery.gte('created_at', query.from);
    if (query.to) dbQuery = dbQuery.lte('created_at', query.to);
    if (query.cursor) dbQuery = dbQuery.lt('created_at', query.cursor);

    const { data, error } = await dbQuery;
    if (error) {
      return err(new InfrastructureError('Failed to list audit log.', { cause: error.message }));
    }

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
  return listAuditLog(request);
}
