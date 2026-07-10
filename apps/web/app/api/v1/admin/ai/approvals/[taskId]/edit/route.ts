import { ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { SupabaseAiApprovalRepository } from '@/server/ai/repositories/supabase-ai-approval-repository';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  taskId: string;
}

const bodySchema = z.object({
  editedOutput: z.record(z.string(), z.unknown()),
  reason: z.string().min(1).max(1000).optional(),
});

/**
 * Ch.9 §11 "Edit" — administrator corrects the draft rather than
 * accepting or discarding it outright; the corrected output replaces the
 * AI's draft in the completed task's metadata.
 */
const editApproval = createApiRoute<undefined, unknown, z.infer<typeof bodySchema>, RouteParams>({
  bodySchema,
  handler: async ({ body, params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();
    const repository = new SupabaseAiApprovalRepository(admin);
    await repository.decide({
      taskId: params.taskId,
      decision: 'edited',
      approverId: actor.id,
      editedOutput: body.editedOutput,
      ...(body.reason ? { reason: body.reason } : {}),
    });

    await recordAuditEvent({
      eventType: 'ai.approval.edited',
      aggregateType: 'ai_task',
      aggregateId: params.taskId,
      actor,
      service: 'ai',
      next: body.editedOutput,
    });

    return ok({ taskId: params.taskId, decision: 'edited' as const });
  },
});

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return editApproval(request, await context.params);
}
