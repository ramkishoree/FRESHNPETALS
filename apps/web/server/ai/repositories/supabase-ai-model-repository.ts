import type { ModelCandidate } from '@prana/ai';
import type { SupabaseClient } from '@supabase/supabase-js';

interface AiModelRow {
  provider: string;
  model_name: string;
  approval_status: ModelCandidate['approvalStatus'];
  health: ModelCandidate['health'];
  supports_structured_output: boolean;
  supports_tool_calling: boolean;
  context_window: number | null;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  avg_latency_ms: number | null;
  metadata: Record<string, unknown>;
}

function mapRow(row: AiModelRow): ModelCandidate {
  return {
    provider: row.provider,
    modelName: row.model_name,
    approvalStatus: row.approval_status,
    health: row.health,
    supportsStructuredOutput: row.supports_structured_output,
    supportsToolCalling: row.supports_tool_calling,
    contextWindow: row.context_window ?? 0,
    inputCostPer1k: row.input_cost_per_1k,
    outputCostPer1k: row.output_cost_per_1k,
    avgLatencyMs: row.avg_latency_ms ?? 0,
    qualityScore:
      typeof row.metadata['qualityScore'] === 'number' ? row.metadata['qualityScore'] : 70,
  };
}

/** Ch.14 §68: Model Registry — "Only approved models may be used in
 * production." Used to build the candidate pool the Model Router picks from. */
export class SupabaseAiModelRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listApproved(): Promise<ModelCandidate[]> {
    const { data, error } = await this.client
      .from('ai_models')
      .select(
        'provider, model_name, approval_status, health, supports_structured_output, supports_tool_calling, context_window, input_cost_per_1k, output_cost_per_1k, avg_latency_ms, metadata',
      )
      .eq('approval_status', 'approved')
      // Deterministic order so every RoutingPolicy's tie-break (each does
      // strict >/< comparisons, which keep the first-seen candidate on a
      // tie) never depends on Postgres's unspecified row-return order.
      .order('provider', { ascending: true })
      .order('model_name', { ascending: true });

    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as AiModelRow[]).map(mapRow);
  }
}
