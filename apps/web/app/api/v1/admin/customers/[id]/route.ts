import { err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { stripUndefined } from '@/lib/strip-undefined';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
}

/** Ch.16 §98: "Status, Tags, Internal Notes, Marketing Preferences." Administrators never see or touch passwords — this endpoint has no path to auth.users at all. */
const bodySchema = z.object({
  status: z.enum(['active', 'flagged', 'blocked']).optional(),
  tags: z.array(z.string()).optional(),
  internal_notes: z.string().optional(),
  marketing_opt_in: z.boolean().optional(),
});

const updateCustomer = createApiRoute<undefined, unknown, z.infer<typeof bodySchema>, RouteParams>({
  bodySchema,
  handler: async ({ body, request, params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from('customers')
      .update({ ...stripUndefined(body), updated_by: actor.id })
      .eq('id', params.id)
      .select('id, status, tags, internal_notes, marketing_opt_in')
      .single();

    if (error)
      return err(new InfrastructureError('Failed to update customer.', { cause: error.message }));

    await recordAuditEvent({
      eventType: 'admin.customer.updated',
      aggregateType: 'customer',
      aggregateId: params.id,
      actor,
      service: 'customers',
      next: body,
      request,
    });

    return ok(data);
  },
});

export async function PATCH(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return updateCustomer(request, await context.params);
}
