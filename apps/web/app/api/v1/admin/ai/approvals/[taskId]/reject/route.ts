import { ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { pickWeeklyBlogTopics } from '@/server/ai/agent-scheduler';
import { runAgentTask } from '@/server/ai/agent-runtime';
import { buildAiOrchestrator } from '@/server/ai/build-orchestrator';
import { SupabaseAiApprovalRepository } from '@/server/ai/repositories/supabase-ai-approval-repository';
import { SupabaseAiTaskRepository } from '@/server/ai/repositories/supabase-ai-task-repository';
import { requireAdmin } from '@/server/auth/session';
import { createApiRoute } from '@/server/http/route-handler';
import { logger } from '@/server/logger';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  taskId: string;
}

const bodySchema = z.object({ reason: z.string().min(1).max(1000).optional() });

const TOPIC_PREFIX = 'Write an article on: ';

/**
 * Owner's explicit ask: denying a blog draft shouldn't just remove it —
 * a fresh replacement (a different topic, not a re-run of the rejected
 * one) should appear for review immediately, so the week's batch slot
 * stays filled and the cycle (deny → regenerate → review) continues on
 * its own until everything's approved.
 */
async function regenerateIfBlogRejected(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  rejectedTaskId: string,
  requestedBy: string,
): Promise<void> {
  const taskRepo = new SupabaseAiTaskRepository(admin);
  const rejectedTask = await taskRepo.findById(rejectedTaskId);
  if (rejectedTask?.agentSlug !== 'blog-writer-ai') return;

  const rejectedTopic = rejectedTask.title.startsWith(TOPIC_PREFIX)
    ? rejectedTask.title.slice(TOPIC_PREFIX.length)
    : rejectedTask.title;

  const [topic] = await pickWeeklyBlogTopics(admin, 1, [rejectedTopic]);
  if (!topic) return;

  const orchestrator = buildAiOrchestrator(admin);
  const result = await runAgentTask(
    { orchestrator, taskRepo },
    { agentSlug: 'blog-writer-ai', taskInstructions: `${TOPIC_PREFIX}${topic}`, requestedBy },
  );
  if (!result.ok) {
    logger.error('ai.approval.reject_regenerate_failed', {
      rejectedTaskId,
      message: result.error.message,
    });
  }
}

/** Ch.16 §124 `POST /api/v1/admin/ai/approvals/{id}/reject`. */
const reject = createApiRoute<undefined, unknown, z.infer<typeof bodySchema>, RouteParams>({
  bodySchema,
  handler: async ({ body, params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const repository = new SupabaseAiApprovalRepository(admin);
    await repository.decide({
      taskId: params.taskId,
      decision: 'rejected',
      approverId: actor.id,
      ...(body.reason ? { reason: body.reason } : {}),
    });

    await recordAuditEvent({
      eventType: 'ai.approval.rejected',
      aggregateType: 'ai_task',
      aggregateId: params.taskId,
      actor,
      service: 'ai',
      next: { reason: body.reason ?? null },
    });

    await regenerateIfBlogRejected(admin, params.taskId, actor.id);

    return ok({ taskId: params.taskId, decision: 'rejected' as const });
  },
});

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return reject(request, await context.params);
}
