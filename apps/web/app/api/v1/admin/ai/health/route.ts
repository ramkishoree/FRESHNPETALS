import { ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';
import { buildAdapterRegistry } from '@/server/ai/adapter-registry';

/**
 * GET /api/v1/admin/ai/health — the concrete AI Gateway entry point
 * (Ch.14 §5: "Authentication, Validation, Context Initialization, Rate
 * Limiting, Logging, Routing... performs no reasoning"). Feeds the
 * Governance Dashboard's "Provider Health" panel (Ch.14 §87) once Phase 8
 * builds it; usable standalone until then.
 */
const checkAiHealth = createApiRoute({
  handler: async () => {
    const registry = buildAdapterRegistry();
    const entries = await Promise.all(
      Object.entries(registry).map(async ([providerName, adapter]) => {
        const health = await adapter.checkHealth();
        return [providerName, health] as const;
      }),
    );
    return ok(Object.fromEntries(entries));
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return checkAiHealth(request);
}
