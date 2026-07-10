import { BusinessRuleError, err, isOk } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { buildAiOrchestrator } from '@/server/ai/build-orchestrator';
import { runAgentTask } from '@/server/ai/agent-runtime';
import { SupabaseAiTaskRepository } from '@/server/ai/repositories/supabase-ai-task-repository';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  taskId: string;
}

/**
 * Ch.9 §11 "Regenerate" — not an approval decision (no `ai_approval_decision`
 * value fits), so this cancels the old task and starts a fresh run of the
 * same agent with the same instructions, rather than going through
 * `ai_approval_decide`.
 */
const regenerate = createApiRoute<undefined, unknown, undefined, RouteParams>({
  handler: async ({ params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const taskRepo = new SupabaseAiTaskRepository(admin);

    const task = await taskRepo.findById(params.taskId);
    if (!task) return err(new BusinessRuleError('AI task not found.', { httpStatus: 404 }));
    if (!task.agentSlug) {
      return err(
        new BusinessRuleError('AI task has no assigned agent to re-run.', { httpStatus: 409 }),
      );
    }
    const taskInstructions = task.metadata['taskInstructions'];
    if (typeof taskInstructions !== 'string') {
      return err(
        new BusinessRuleError('Original task instructions are unavailable for regeneration.', {
          httpStatus: 409,
        }),
      );
    }

    await taskRepo.cancel(params.taskId);

    const orchestrator = buildAiOrchestrator(admin);
    const result = await runAgentTask(
      { orchestrator, taskRepo },
      { agentSlug: task.agentSlug, taskInstructions, requestedBy: actor.id },
    );

    if (isOk(result)) {
      await recordAuditEvent({
        eventType: 'ai.approval.regenerated',
        aggregateType: 'ai_task',
        aggregateId: result.value.taskId,
        actor,
        service: 'ai',
        previous: { originalTaskId: params.taskId },
      });
    }

    return result;
  },
});

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return regenerate(request, await context.params);
}
