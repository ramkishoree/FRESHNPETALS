import { ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SupabaseAiTaskRepository } from '@/server/ai/repositories/supabase-ai-task-repository';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

const TASK_STATUSES = [
  'queued',
  'running',
  'waiting_approval',
  'completed',
  'rejected',
  'cancelled',
  'failed',
] as const;

const querySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Ch.16 §119 AI Task Queue API. */
const listTasks = createApiRoute({
  querySchema,
  handler: async ({ query }) => {
    const admin = createSupabaseAdminClient();
    const repository = new SupabaseAiTaskRepository(admin);
    const tasks = await repository.list({
      ...(query.status ? { status: query.status } : {}),
      limit: query.limit,
    });
    return ok(tasks);
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return listTasks(request);
}
