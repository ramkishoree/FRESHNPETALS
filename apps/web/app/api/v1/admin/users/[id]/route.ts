import { err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
}

/** Ch.16 §110: "Roles, Permissions... Session Revocation." */
const bodySchema = z.object({
  status: z.enum(['active', 'suspended', 'deactivated']).optional(),
  roles: z.array(z.enum(['anonymous', 'customer', 'administrator', 'owner'])).optional(),
});

const updateUser = createApiRoute<undefined, unknown, z.infer<typeof bodySchema>, RouteParams>({
  bodySchema,
  handler: async ({ body, request, params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();

    if (body.status !== undefined) {
      const { error } = await admin
        .from('users')
        .update({ status: body.status })
        .eq('id', params.id);
      if (error)
        return err(
          new InfrastructureError('Failed to update user status.', { cause: error.message }),
        );
    }

    if (body.roles !== undefined) {
      const { error } = await admin.rpc('admin_set_user_roles', {
        p_user_id: params.id,
        p_role_names: body.roles,
        p_actor_id: actor.id,
      });
      if (error)
        return err(
          new InfrastructureError('Failed to update user roles.', { cause: error.message }),
        );
    }

    await recordAuditEvent({
      eventType: 'admin.user.updated',
      aggregateType: 'user',
      aggregateId: params.id,
      actor,
      service: 'users',
      next: body,
      severity: body.roles !== undefined ? 'warning' : 'info',
      request,
    });

    const { data, error } = await admin
      .from('users')
      .select('id, email, phone, full_name, status')
      .eq('id', params.id)
      .single();
    if (error)
      return err(new InfrastructureError('Failed to re-read user.', { cause: error.message }));

    return ok(data);
  },
});

const deactivateUser = createApiRoute<undefined, unknown, undefined, RouteParams>({
  handler: async ({ request, params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();

    const { error } = await admin
      .from('users')
      .update({ status: 'deactivated' })
      .eq('id', params.id);
    if (error)
      return err(new InfrastructureError('Failed to deactivate user.', { cause: error.message }));

    await recordAuditEvent({
      eventType: 'admin.user.deactivated',
      aggregateType: 'user',
      aggregateId: params.id,
      actor,
      service: 'users',
      severity: 'warning',
      request,
    });

    return ok({ id: params.id, status: 'deactivated' });
  },
});

export async function PATCH(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return updateUser(request, await context.params);
}

export async function DELETE(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return deactivateUser(request, await context.params);
}
