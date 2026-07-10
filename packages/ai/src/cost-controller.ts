/**
 * Ch.14 §31-§34/§81: every execution is estimated and budget-checked
 * before it runs. Thresholds 50/75/90/100%; at 100%, non-essential tasks
 * pause automatically but a critical workflow may continue if an
 * administrator has explicitly allowed it.
 */

export type BudgetThreshold = 50 | 75 | 90 | 100;

const THRESHOLDS: BudgetThreshold[] = [50, 75, 90, 100];

export interface BudgetCheckInput {
  currentSpend: number;
  limit: number;
  isCriticalTask: boolean;
  allowCriticalOverride: boolean;
}

export interface BudgetCheckResult {
  allowed: boolean;
  utilizationPct: number;
  crossedThresholds: BudgetThreshold[];
  reason?: 'critical_override' | 'budget_exceeded';
}

export function checkBudget(input: BudgetCheckInput): BudgetCheckResult {
  const utilizationPct = input.limit <= 0 ? 100 : (input.currentSpend / input.limit) * 100;
  const crossedThresholds = THRESHOLDS.filter((t) => utilizationPct >= t);

  if (utilizationPct < 100) {
    return { allowed: true, utilizationPct, crossedThresholds };
  }

  if (input.isCriticalTask && input.allowCriticalOverride) {
    return { allowed: true, utilizationPct, crossedThresholds, reason: 'critical_override' };
  }

  return { allowed: false, utilizationPct, crossedThresholds, reason: 'budget_exceeded' };
}

export function estimateCostUsd(
  promptTokens: number,
  completionTokens: number,
  inputCostPer1k: number,
  outputCostPer1k: number,
): number {
  return (promptTokens / 1000) * inputCostPer1k + (completionTokens / 1000) * outputCostPer1k;
}
