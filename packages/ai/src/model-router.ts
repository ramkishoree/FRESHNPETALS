/**
 * Ch.14 §14-§16: Model Router selects provider/model by capability,
 * latency, cost, context, historical accuracy, provider health, budget,
 * and admin preference — governed by a configurable, swappable policy
 * ("Policies can change without modifying application code").
 */

export type RoutingPolicy =
  'lowest_cost' | 'highest_quality' | 'fastest' | 'balanced' | 'emergency' | 'testing';

export type ModelApprovalStatus = 'pending' | 'approved' | 'deprecated' | 'rejected';
export type ModelHealthStatus = 'healthy' | 'warning' | 'degraded' | 'offline';

export interface ModelCandidate {
  provider: string;
  modelName: string;
  approvalStatus: ModelApprovalStatus;
  health: ModelHealthStatus;
  supportsStructuredOutput: boolean;
  supportsToolCalling: boolean;
  contextWindow: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  avgLatencyMs: number;
  /** 0-100, admin-configured or derived from historical accuracy (§14). */
  qualityScore: number;
}

export interface RoutingRequest {
  policy: RoutingPolicy;
  requiresStructuredOutput?: boolean;
  requiresToolCalling?: boolean;
  minContextWindow?: number;
}

function averageCostPer1k(candidate: ModelCandidate): number {
  return (candidate.inputCostPer1k + candidate.outputCostPer1k) / 2;
}

/** Normalizes cost/latency (lower is better) and quality (higher is better)
 * into one 0-1-ish comparable score, weighted evenly across all eligible
 * candidates being compared. */
function balancedScore(candidate: ModelCandidate, pool: ModelCandidate[]): number {
  const costs = pool.map(averageCostPer1k);
  const latencies = pool.map((c) => c.avgLatencyMs);
  const maxCost = Math.max(...costs, 1e-9);
  const maxLatency = Math.max(...latencies, 1);

  const costScore = 1 - averageCostPer1k(candidate) / maxCost;
  const latencyScore = 1 - candidate.avgLatencyMs / maxLatency;
  const qualityScore = candidate.qualityScore / 100;

  return costScore * 0.35 + latencyScore * 0.25 + qualityScore * 0.4;
}

function isEligible(candidate: ModelCandidate, request: RoutingRequest): boolean {
  return (
    candidate.approvalStatus === 'approved' &&
    candidate.health !== 'offline' &&
    (!request.requiresStructuredOutput || candidate.supportsStructuredOutput) &&
    (!request.requiresToolCalling || candidate.supportsToolCalling) &&
    (!request.minContextWindow || candidate.contextWindow >= request.minContextWindow)
  );
}

/** Returns the selected model, or null if nothing eligible — the caller
 * (orchestrator) treats null as "no route available", not a crash. */
export function selectModel(
  candidates: ModelCandidate[],
  request: RoutingRequest,
): ModelCandidate | null {
  const eligible = candidates.filter((c) => isEligible(c, request));
  if (eligible.length === 0) return null;

  switch (request.policy) {
    case 'lowest_cost':
      return eligible.reduce((best, c) =>
        averageCostPer1k(c) < averageCostPer1k(best) ? c : best,
      );

    case 'highest_quality':
      return eligible.reduce((best, c) => (c.qualityScore > best.qualityScore ? c : best));

    case 'fastest':
      return eligible.reduce((best, c) => (c.avgLatencyMs < best.avgLatencyMs ? c : best));

    case 'emergency': {
      // Emergency mode: get *a* working model, healthy and fast beats
      // cheap or "best" — degraded providers are still eligible here
      // (offline is already filtered out) so a working answer is more
      // valuable than an ideal one.
      const healthy = eligible.filter((c) => c.health === 'healthy');
      const pool = healthy.length > 0 ? healthy : eligible;
      return [...pool].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0] ?? null;
    }

    case 'testing':
      // Deterministic (alphabetical) so routing-dependent tests are stable.
      return [...eligible].sort((a, b) => a.modelName.localeCompare(b.modelName))[0] ?? null;

    case 'balanced':
    default:
      return eligible.reduce((best, c) =>
        balancedScore(c, eligible) > balancedScore(best, eligible) ? c : best,
      );
  }
}
