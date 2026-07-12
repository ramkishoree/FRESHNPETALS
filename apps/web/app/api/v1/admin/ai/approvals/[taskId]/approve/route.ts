import { ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { applyApprovedAgentOutput } from '@/server/ai/apply-agent-output';
import { SupabaseAiApprovalRepository } from '@/server/ai/repositories/supabase-ai-approval-repository';
import { SupabaseAiTaskRepository } from '@/server/ai/repositories/supabase-ai-task-repository';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  taskId: string;
}

/**
 * Ch.16 §124 `POST /api/v1/admin/ai/approvals/{id}/approve`. For agents
 * with a well-defined apply action (currently just blog-writer-ai — see
 * apply-agent-output.ts for why the others aren't included yet),
 * approving here doesn't just mark the task reviewed, it actually
 * publishes the draft. Applying after decide() succeeds, not before —
 * a task that's already been approved but fails to apply is a much
 * better failure mode than one that got applied but never recorded as
 * approved.
 */
const approve = createApiRoute<undefined, unknown, undefined, RouteParams>({
  handler: async ({ params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const approvalRepo = new SupabaseAiApprovalRepository(admin);
    const taskRepo = new SupabaseAiTaskRepository(admin);

    await approvalRepo.decide({
      taskId: params.taskId,
      decision: 'approved',
      approverId: actor.id,
    });

    const task = await taskRepo.findById(params.taskId);
    const applyResult = task ? await applyApprovedAgentOutput(admin, task) : { applied: false };

    await recordAuditEvent({
      eventType: 'ai.approval.approved',
      aggregateType: 'ai_task',
      aggregateId: params.taskId,
      actor,
      service: 'ai',
      next: applyResult,
    });

    return ok({ taskId: params.taskId, decision: 'approved' as const, ...applyResult });
  },
});

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return approve(request, await context.params);
}
