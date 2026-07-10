import { describe, expect, it } from 'vitest';
import {
  estimateTokenCount,
  getAvailablePromptTokenBudget,
  isWithinContextBudget,
} from './context-window';

describe('getAvailablePromptTokenBudget', () => {
  it('caps at 80% of the model context window (Ch.14 §26)', () => {
    expect(getAvailablePromptTokenBudget(128_000)).toBe(102_400);
    expect(getAvailablePromptTokenBudget(8_000)).toBe(6_400);
  });
});

describe('isWithinContextBudget', () => {
  it('is true at or under 80% of context', () => {
    expect(isWithinContextBudget(6_400, 8_000)).toBe(true);
    expect(isWithinContextBudget(100, 8_000)).toBe(true);
  });

  it('is false above 80% of context', () => {
    expect(isWithinContextBudget(6_401, 8_000)).toBe(false);
  });
});

describe('estimateTokenCount', () => {
  it('estimates roughly 4 characters per token', () => {
    expect(estimateTokenCount('a'.repeat(400))).toBe(100);
  });

  it('rounds up for partial tokens', () => {
    expect(estimateTokenCount('abc')).toBe(1);
  });
});
