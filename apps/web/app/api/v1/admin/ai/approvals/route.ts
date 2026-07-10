import { ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SupabaseAiTaskRepository } from '@/server/ai/repositories/supabase-ai-task-repository';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/**
 * Ch.16 §124 AI Approval API — the Approval Queue is `ai_tasks` filtered
 * to `waiting_approval` (Ch.9 §11); there is no separate queue table.
 */
const listApprovals = createApiRoute({
  handler: async () => {
    const admin = createSupabaseAdminClient();
    const repository = new SupabaseAiTaskRepository(admin);
    const tasks = await repository.list({ status: 'waiting_approval', limit: 100 });
    return ok(tasks);
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return listApprovals(request);
}
