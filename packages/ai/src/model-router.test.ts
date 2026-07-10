import { describe, expect, it } from 'vitest';
import { type ModelCandidate, selectModel } from './model-router';

function makeCandidate(overrides: Partial<ModelCandidate> = {}): ModelCandidate {
  return {
    provider: 'openai',
    modelName: 'gpt-4o',
    approvalStatus: 'approved',
    health: 'healthy',
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    contextWindow: 128_000,
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    avgLatencyMs: 800,
    qualityScore: 90,
    ...overrides,
  };
}

describe('selectModel', () => {
  it('returns null when no candidate is eligible', () => {
    const result = selectModel([makeCandidate({ approvalStatus: 'pending' })], {
      policy: 'balanced',
    });
    expect(result).toBeNull();
  });

  it('excludes offline providers even under emergency policy', () => {
    const candidates = [
      makeCandidate({ modelName: 'a', health: 'offline' }),
      makeCandidate({ modelName: 'b', health: 'healthy' }),
    ];
    const result = selectModel(candidates, { policy: 'emergency' });
    expect(result?.modelName).toBe('b');
  });

  it('excludes unapproved models (Ch.14 §68 governance gate)', () => {
    const candidates = [
      makeCandidate({ modelName: 'unapproved', approvalStatus: 'pending' }),
      makeCandidate({ modelName: 'approved-one', approvalStatus: 'approved' }),
    ];
    const result = selectModel(candidates, { policy: 'lowest_cost' });
    expect(result?.modelName).toBe('approved-one');
  });

  it('filters out models missing a required capability', () => {
    const candidates = [
      makeCandidate({ modelName: 'no-structured', supportsStructuredOutput: false }),
      makeCandidate({ modelName: 'has-structured', supportsStructuredOutput: true }),
    ];
    const result = selectModel(candidates, { policy: 'balanced', requiresStructuredOutput: true });
    expect(result?.modelName).toBe('has-structured');
  });

  it('filters out models below the minimum context window', () => {
    const candidates = [
      makeCandidate({ modelName: 'small', contextWindow: 8000 }),
      makeCandidate({ modelName: 'big', contextWindow: 128_000 }),
    ];
    const result = selectModel(candidates, { policy: 'balanced', minContextWindow: 32_000 });
    expect(result?.modelName).toBe('big');
  });

  it('lowest_cost picks the cheapest average of input/output cost', () => {
    const candidates = [
      makeCandidate({ modelName: 'expensive', inputCostPer1k: 0.02, outputCostPer1k: 0.06 }),
      makeCandidate({ modelName: 'cheap', inputCostPer1k: 0.001, outputCostPer1k: 0.002 }),
    ];
    const result = selectModel(candidates, { policy: 'lowest_cost' });
    expect(result?.modelName).toBe('cheap');
  });

  it('highest_quality picks the highest qualityScore', () => {
    const candidates = [
      makeCandidate({ modelName: 'mediocre', qualityScore: 60 }),
      makeCandidate({ modelName: 'best', qualityScore: 95 }),
    ];
    const result = selectModel(candidates, { policy: 'highest_quality' });
    expect(result?.modelName).toBe('best');
  });

  it('fastest picks the lowest avgLatencyMs', () => {
    const candidates = [
      makeCandidate({ modelName: 'slow', avgLatencyMs: 3000 }),
      makeCandidate({ modelName: 'fast', avgLatencyMs: 300 }),
    ];
    const result = selectModel(candidates, { policy: 'fastest' });
    expect(result?.modelName).toBe('fast');
  });

  it('testing policy is deterministic (alphabetical)', () => {
    const candidates = [
      makeCandidate({ modelName: 'zeta' }),
      makeCandidate({ modelName: 'alpha' }),
    ];
    const result = selectModel(candidates, { policy: 'testing' });
    expect(result?.modelName).toBe('alpha');
  });

  it('emergency prefers a healthy model even if a degraded one is cheaper/better', () => {
    const candidates = [
      makeCandidate({
        modelName: 'degraded-cheap',
        health: 'degraded',
        inputCostPer1k: 0.0001,
        avgLatencyMs: 100,
      }),
      makeCandidate({ modelName: 'healthy-slower', health: 'healthy', avgLatencyMs: 1000 }),
    ];
    const result = selectModel(candidates, { policy: 'emergency' });
    expect(result?.modelName).toBe('healthy-slower');
  });

  it('balanced weighs cost, latency, and quality together', () => {
    const candidates = [
      makeCandidate({
        modelName: 'cheap-slow-mediocre',
        inputCostPer1k: 0.001,
        outputCostPer1k: 0.001,
        avgLatencyMs: 5000,
        qualityScore: 50,
      }),
      makeCandidate({
        modelName: 'balanced-choice',
        inputCostPer1k: 0.003,
        outputCostPer1k: 0.006,
        avgLatencyMs: 500,
        qualityScore: 90,
      }),
    ];
    const result = selectModel(candidates, { policy: 'balanced' });
    expect(result?.modelName).toBe('balanced-choice');
  });
});
