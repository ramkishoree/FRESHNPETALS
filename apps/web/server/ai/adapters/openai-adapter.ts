import { estimateTokenCount } from '@prana/ai';
import type {
  CostEstimate,
  EmbeddingInput,
  EmbeddingOutput,
  GenerateTextInput,
  GenerateTextOutput,
  ProviderAdapter,
  ProviderHealth,
  StructuredOutputInput,
  StructuredOutputOutput,
} from '@prana/ai';
import OpenAI from 'openai';

/**
 * Ch.14 §7/§8: the only file in this codebase allowed to import the
 * `openai` SDK. Everything else talks to `ProviderAdapter`.
 */
export class OpenAiAdapter implements ProviderAdapter {
  readonly providerName = 'openai';
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const response = await this.client.chat.completions.create({
      model: input.model,
      messages: [
        ...(input.systemPrompt ? [{ role: 'system' as const, content: input.systemPrompt }] : []),
        ...input.messages,
      ],
      ...(input.maxTokens !== undefined ? { max_tokens: input.maxTokens } : {}),
      ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
    });

    return {
      text: response.choices[0]?.message.content ?? '',
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    };
  }

  async generateStructuredOutput<T>(
    input: StructuredOutputInput,
  ): Promise<StructuredOutputOutput<T>> {
    const response = await this.client.chat.completions.create({
      model: input.model,
      response_format: { type: 'json_object' },
      messages: [
        ...(input.systemPrompt ? [{ role: 'system' as const, content: input.systemPrompt }] : []),
        ...input.messages,
      ],
      ...(input.maxTokens !== undefined ? { max_tokens: input.maxTokens } : {}),
      ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
    });

    const raw = response.choices[0]?.message.content ?? '{}';
    return {
      data: JSON.parse(raw) as T,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    };
  }

  async generateEmbeddings(input: EmbeddingInput): Promise<EmbeddingOutput> {
    const response = await this.client.embeddings.create({
      model: input.model,
      input: input.input,
    });
    return {
      embeddings: response.data.map((item) => item.embedding),
      promptTokens: response.usage.prompt_tokens,
    };
  }

  async checkHealth(): Promise<ProviderHealth> {
    const startedAt = Date.now();
    try {
      await this.client.models.list();
      return {
        status: 'healthy',
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      };
    } catch {
      return { status: 'offline', checkedAt: new Date().toISOString() };
    }
  }

  estimateCost(input: GenerateTextInput): CostEstimate {
    const estimatedPromptTokens = estimateTokenCount(
      (input.systemPrompt ?? '') + input.messages.map((m) => m.content).join(' '),
    );
    const estimatedCompletionTokens = input.maxTokens ?? 512;
    return {
      estimatedPromptTokens,
      estimatedCompletionTokens,
      // Rough placeholder rate; real per-model rates live in ai_models
      // (Ch.14 §68) and are what the cost controller actually uses —
      // this method exists so the adapter satisfies the interface
      // without a database round-trip.
      estimatedCostUsd:
        (estimatedPromptTokens / 1000) * 0.005 + (estimatedCompletionTokens / 1000) * 0.015,
    };
  }

  countTokens(text: string): number {
    return estimateTokenCount(text);
  }
}
