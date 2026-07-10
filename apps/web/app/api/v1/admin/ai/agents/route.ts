import { AI_EMPLOYEES } from '@prana/ai';
import { ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/**
 * Ch.16 §117 AI Agent API — "Manage AI Employees." The Capability
 * Registry (packages/ai) is the source of truth for what each agent can
 * do; this route merges in live task-status counts so the admin UI can
 * show "3 waiting approval" etc. without a second round trip.
 */
const listAgents = createApiRoute({
  handler: async () => {
    const admin = createSupabaseAdminClient();
    const { data: agentRows } = await admin.from('ai_agents').select('id, slug, status');
    const { data: taskCounts } = await admin.from('ai_tasks').select('assigned_agent, status');

    const agents = AI_EMPLOYEES.map((agent) => {
      const dbAgent = agentRows?.find((row) => row.slug === agent.slug);
      const counts = (taskCounts ?? []).filter((task) => task.assigned_agent === dbAgent?.id);
      return {
        ...agent,
        status: dbAgent?.status ?? 'inactive',
        waitingApprovalCount: counts.filter((t) => t.status === 'waiting_approval').length,
        completedCount: counts.filter((t) => t.status === 'completed').length,
        failedCount: counts.filter((t) => t.status === 'failed').length,
      };
    });

    return ok(agents);
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return listAgents(request);
}
