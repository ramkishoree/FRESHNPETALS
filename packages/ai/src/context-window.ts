/**
 * Ch.14 §26: "Maximum context utilization Target ≤80% of model context.
 * Reserve remaining capacity for reasoning, tool calls, structured output."
 */

const MAX_CONTEXT_UTILIZATION = 0.8;

export function getAvailablePromptTokenBudget(modelContextWindow: number): number {
  return Math.floor(modelContextWindow * MAX_CONTEXT_UTILIZATION);
}

export function isWithinContextBudget(promptTokens: number, modelContextWindow: number): boolean {
  return promptTokens <= getAvailablePromptTokenBudget(modelContextWindow);
}

/** Coarse, provider-agnostic estimate (~4 chars/token in English) — used
 * for pre-flight budget checks before a real tokenizer count is available;
 * a provider adapter's own `countTokens` is the authoritative figure. */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
