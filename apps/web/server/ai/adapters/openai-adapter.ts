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

// A response cut off by the max_tokens ceiling mid-JSON produces a
// cryptic "Unexpected token"/"Unexpected end of JSON input" from
// JSON.parse with no indication of the real cause — see the identical
// guard in anthropic-adapter.ts, which is what surfaced this failure
// mode in production for blog-writer-ai.
function assertNotTruncated(finishReason: string | null | undefined, maxTokens: number): void {
  if (finishReason === 'length') {
    throw new Error(
      `Response was truncated: it hit the ${maxTokens}-token maxTokens ceiling before finishing. Increase maxTokens for this agent.`,
    );
  }
}

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
    // response_format: json_object has a hard OpenAI-API requirement that
    // the word "json" appear somewhere in the messages, or the request
    // 400s outright — and without ever telling the model the schema, JSON
    // mode only guarantees syntactically valid JSON, not the right shape.
    // Build the same explicit schema instruction anthropic-adapter.ts
    // uses, which satisfies both at once.
    const schemaInstruction = `Respond with ONLY valid JSON matching this schema, no prose, no markdown fences:\n${JSON.stringify(input.jsonSchema)}`;
    const system = input.systemPrompt
      ? `${input.systemPrompt}\n\n${schemaInstruction}`
      : schemaInstruction;

    const response = await this.client.chat.completions.create({
      model: input.model,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system' as const, content: system }, ...input.messages],
      ...(input.maxTokens !== undefined ? { max_tokens: input.maxTokens } : {}),
      ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
    });

    assertNotTruncated(response.choices[0]?.finish_reason, input.maxTokens ?? 512);
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
