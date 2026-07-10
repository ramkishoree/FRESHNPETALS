import { ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { SupabaseAiApprovalRepository } from '@/server/ai/repositories/supabase-ai-approval-repository';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  taskId: string;
}

/** Ch.16 §124 `POST /api/v1/admin/ai/approvals/{id}/approve`. */
const approve = createApiRoute<undefined, unknown, undefined, RouteParams>({
  handler: async ({ params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const repository = new SupabaseAiApprovalRepository(admin);
    await repository.decide({ taskId: params.taskId, decision: 'approved', approverId: actor.id });

    await recordAuditEvent({
      eventType: 'ai.approval.approved',
      aggregateType: 'ai_task',
      aggregateId: params.taskId,
      actor,
      service: 'ai',
    });

    return ok({ taskId: params.taskId, decision: 'approved' as const });
  },
});

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return approve(request, await context.params);
}
