import type { KillSwitchState } from '@prana/ai';
import type { SupabaseClient } from '@supabase/supabase-js';

type BudgetScope = 'global' | 'provider' | 'agent' | 'workflow';
type BudgetPeriod = 'daily' | 'weekly' | 'monthly';

function periodStart(period: BudgetPeriod): Date {
  const now = new Date();
  if (period === 'daily') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'weekly') {
    const dayOfWeek = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Ch.14 §80 (Kill Switch) + §81 (Budget Enforcement). Reads feed the pure
 * `checkKillSwitches`/`checkBudget` functions in packages/ai; this class
 * only fetches/records, it makes no allow/block decisions itself.
 */
export class SupabaseAiGovernanceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getActiveKillSwitches(): Promise<KillSwitchState[]> {
    const { data, error } = await this.client
      .from('ai_kill_switches')
      .select('scope, scope_ref, disabled')
      .eq('disabled', true);

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      scope: row.scope as KillSwitchState['scope'],
      scopeRef: row.scope_ref as string | null,
      disabled: row.disabled as boolean,
    }));
  }

  async getBudgetLimit(
    scope: BudgetScope,
    scopeRef: string | null,
    period: BudgetPeriod,
  ): Promise<number | null> {
    let query = this.client
      .from('ai_budgets')
      .select('limit_amount')
      .eq('scope', scope)
      .eq('period', period);
    query = scopeRef ? query.eq('scope_ref', scopeRef) : query.is('scope_ref', null);

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    return data ? Number(data.limit_amount) : null;
  }

  /** Sums ai_cost_tracking within the current period window, scoped to
   * whichever dimension the budget applies to. `global` sums everything;
   * every other scope filters to its matching column. */
  async getCurrentSpend(
    scope: BudgetScope,
    scopeRef: string | null,
    period: BudgetPeriod,
  ): Promise<number> {
    let query = this.client
      .from('ai_cost_tracking')
      .select('input_cost, output_cost')
      .gte('created_at', periodStart(period).toISOString());

    if (scopeRef) {
      if (scope === 'provider') query = query.eq('provider', scopeRef);
      else if (scope === 'agent') query = query.eq('agent_id', scopeRef);
      else if (scope === 'workflow') query = query.eq('workflow_run_id', scopeRef);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).reduce(
      (sum, row) => sum + Number(row.input_cost) + Number(row.output_cost),
      0,
    );
  }

  async recordCost(entry: {
    agentId?: string;
    taskId?: string;
    workflowRunId?: string;
    model: string;
    provider: string;
    promptTokens: number;
    completionTokens: number;
    inputCost: number;
    outputCost: number;
    latencyMs?: number;
  }): Promise<void> {
    const { error } = await this.client.from('ai_cost_tracking').insert({
      agent_id: entry.agentId ?? null,
      task_id: entry.taskId ?? null,
      workflow_run_id: entry.workflowRunId ?? null,
      model: entry.model,
      provider: entry.provider,
      tokens: entry.promptTokens + entry.completionTokens,
      prompt_tokens: entry.promptTokens,
      completion_tokens: entry.completionTokens,
      input_cost: entry.inputCost,
      output_cost: entry.outputCost,
      latency_ms: entry.latencyMs ?? null,
    });
    if (error) throw new Error(error.message);
  }
}
