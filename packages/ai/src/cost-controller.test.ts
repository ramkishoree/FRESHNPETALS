import { describe, expect, it } from 'vitest';
import { checkBudget, estimateCostUsd } from './cost-controller';

describe('checkBudget', () => {
  it('allows spend under every threshold with no crossed thresholds', () => {
    const result = checkBudget({
      currentSpend: 10,
      limit: 100,
      isCriticalTask: false,
      allowCriticalOverride: false,
    });
    expect(result.allowed).toBe(true);
    expect(result.utilizationPct).toBe(10);
    expect(result.crossedThresholds).toEqual([]);
  });

  it('reports every threshold crossed (Ch.14 §32/§81: 50/75/90/100%)', () => {
    const result = checkBudget({
      currentSpend: 92,
      limit: 100,
      isCriticalTask: false,
      allowCriticalOverride: false,
    });
    expect(result.crossedThresholds).toEqual([50, 75, 90]);
    expect(result.allowed).toBe(true);
  });

  it('blocks a non-critical task at 100% budget', () => {
    const result = checkBudget({
      currentSpend: 100,
      limit: 100,
      isCriticalTask: false,
      allowCriticalOverride: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('budget_exceeded');
    expect(result.crossedThresholds).toEqual([50, 75, 90, 100]);
  });

  it('blocks a critical task at 100% budget unless explicitly overridden', () => {
    const blocked = checkBudget({
      currentSpend: 150,
      limit: 100,
      isCriticalTask: true,
      allowCriticalOverride: false,
    });
    expect(blocked.allowed).toBe(false);

    const overridden = checkBudget({
      currentSpend: 150,
      limit: 100,
      isCriticalTask: true,
      allowCriticalOverride: true,
    });
    expect(overridden.allowed).toBe(true);
    expect(overridden.reason).toBe('critical_override');
  });

  it('treats a zero/invalid limit as fully exhausted rather than dividing by zero', () => {
    const result = checkBudget({
      currentSpend: 1,
      limit: 0,
      isCriticalTask: false,
      allowCriticalOverride: false,
    });
    expect(result.utilizationPct).toBe(100);
    expect(result.allowed).toBe(false);
  });
});

describe('estimateCostUsd', () => {
  it('computes cost from per-1k-token rates', () => {
    const cost = estimateCostUsd(1000, 500, 0.01, 0.03);
    expect(cost).toBeCloseTo(0.01 + 0.015, 6);
  });

  it('is zero for zero tokens', () => {
    expect(estimateCostUsd(0, 0, 0.01, 0.03)).toBe(0);
  });
});
