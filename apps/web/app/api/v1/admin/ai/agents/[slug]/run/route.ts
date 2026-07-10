import { isOk } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { buildAiOrchestrator } from '@/server/ai/build-orchestrator';
import { runAgentTask } from '@/server/ai/agent-runtime';
import { SupabaseAiTaskRepository } from '@/server/ai/repositories/supabase-ai-task-repository';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  slug: string;
}

const bodySchema = z.object({
  taskInstructions: z.string().min(3).max(4000),
});

/**
 * Ch.9 §34 Task Lifecycle entry point. Every run lands in the Approval
 * Queue on success (Ch.9 §11) — there is no synchronous "apply" path.
 */
const runAgent = createApiRoute<undefined, unknown, z.infer<typeof bodySchema>, RouteParams>({
  bodySchema,
  handler: async ({ body, params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const orchestrator = buildAiOrchestrator(admin);
    const taskRepo = new SupabaseAiTaskRepository(admin);

    const result = await runAgentTask(
      { orchestrator, taskRepo },
      { agentSlug: params.slug, taskInstructions: body.taskInstructions, requestedBy: actor.id },
    );

    if (isOk(result)) {
      await recordAuditEvent({
        eventType: 'ai.agent.run',
        aggregateType: 'ai_task',
        aggregateId: result.value.taskId,
        actor,
        service: 'ai',
        next: { agentSlug: params.slug, taskInstructions: body.taskInstructions },
      });
    }

    return result;
  },
});

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return runAgent(request, await context.params);
}
