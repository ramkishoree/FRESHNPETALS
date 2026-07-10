import { AuthorizationError, BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  key: string;
}

/** Ch.16 §112: "Critical settings require Owner role." Enforced here in addition to RLS's own owner gate (migration 0024), so a non-owner gets a clear 403 rather than a silent no-op update. */
const bodySchema = z.object({
  value: z.unknown(),
});

const updateSetting = createApiRoute<undefined, unknown, z.infer<typeof bodySchema>, RouteParams>({
  bodySchema,
  handler: async ({ body, request, params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();

    const { data: existing, error: findError } = await admin
      .from('system_settings')
      .select('id, requires_owner')
      .eq('key', params.key)
      .maybeSingle();

    if (findError) {
      return err(
        new InfrastructureError('Failed to look up setting.', { cause: findError.message }),
      );
    }
    if (!existing) {
      return err(new BusinessRuleError('Setting not found.', { httpStatus: 404 }));
    }
    if (existing.requires_owner && !actor.roles.some((role) => role === 'owner')) {
      return err(new AuthorizationError('This setting can only be changed by the Owner.'));
    }

    const { data, error } = await admin
      .from('system_settings')
      .update({ value: body.value, updated_by: actor.id })
      .eq('key', params.key)
      .select('id, key, category, value, requires_owner, updated_at')
      .single();

    if (error) {
      return err(new InfrastructureError('Failed to update setting.', { cause: error.message }));
    }

    await recordAuditEvent({
      eventType: 'admin.setting.updated',
      aggregateType: 'system_setting',
      aggregateId: existing.id,
      actor,
      service: 'settings',
      next: body,
      severity: existing.requires_owner ? 'critical' : 'info',
      request,
    });

    return ok(data);
  },
});

export async function PATCH(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return updateSetting(request, await context.params);
}
