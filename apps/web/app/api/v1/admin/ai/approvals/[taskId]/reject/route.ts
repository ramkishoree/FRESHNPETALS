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

const bodySchema = z.object({ reason: z.string().min(1).max(1000).optional() });

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

    return ok({ taskId: params.taskId, decision: 'rejected' as const });
  },
});

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return reject(request, await context.params);
}
