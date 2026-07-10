/**
 * Ch.14 §7/§8: "The application shall never directly depend upon [a
 * provider] SDK... Instead: Application → Provider Adapter → Provider."
 * Every provider (OpenAI, Anthropic, Groq — v1, §9) implements this same
 * interface; no provider-specific code exists outside its own adapter
 * (apps/web/server/ai/adapters/*, which is the only place an SDK import
 * for OpenAI/Anthropic is allowed to appear).
 */

export interface GenerateTextInput {
  model: string;
  systemPrompt?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateTextOutput {
  text: string;
  promptTokens: number;
  completionTokens: number;
}

export interface StructuredOutputInput<TSchema = unknown> extends GenerateTextInput {
  /** JSON Schema the response must conform to (Ch.14 §22: "Schema validation is mandatory"). */
  jsonSchema: TSchema;
}

export interface StructuredOutputOutput<T = unknown> {
  data: T;
  promptTokens: number;
  completionTokens: number;
}

export interface EmbeddingInput {
  model: string;
  input: string[];
}

export interface EmbeddingOutput {
  embeddings: number[][];
  promptTokens: number;
}

export type ProviderHealthStatus = 'healthy' | 'warning' | 'degraded' | 'offline';

export interface ProviderHealth {
  status: ProviderHealthStatus;
  latencyMs?: number;
  checkedAt: string;
}

export interface CostEstimate {
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  estimatedCostUsd: number;
}

export interface ProviderAdapter {
  readonly providerName: string;
  generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
  generateStructuredOutput<T>(input: StructuredOutputInput): Promise<StructuredOutputOutput<T>>;
  generateEmbeddings(input: EmbeddingInput): Promise<EmbeddingOutput>;
  checkHealth(): Promise<ProviderHealth>;
  estimateCost(input: GenerateTextInput): CostEstimate;
  countTokens(text: string): number;
}
