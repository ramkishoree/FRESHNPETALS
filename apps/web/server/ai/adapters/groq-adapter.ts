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

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

// See the identical guard in anthropic-adapter.ts — a response cut off by
// the max_tokens ceiling mid-JSON otherwise fails JSON.parse with a
// cryptic error that gives no indication of the real cause.
function assertNotTruncated(finishReason: string | null | undefined, maxTokens: number): void {
  if (finishReason === 'length') {
    throw new Error(
      `Response was truncated: it hit the ${maxTokens}-token maxTokens ceiling before finishing. Increase maxTokens for this agent.`,
    );
  }
}

/**
 * Groq's API is OpenAI-compatible, so the `openai` SDK works against it
 * with just a different base URL and key — still its own adapter file
 * (Ch.14 §7: "no provider-specific code exists outside adapters"), since
 * Groq's actual capabilities differ (no embeddings endpoint, §9 lists it
 * as a v1 provider for fast/cheap text generation only).
 */
export class GroqAdapter implements ProviderAdapter {
  readonly providerName = 'groq';
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });
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
    // response_format: json_object has a hard OpenAI-compatible-API
    // requirement (Groq mirrors OpenAI's API shape) that the word "json"
    // appear somewhere in the messages, or the request 400s outright —
    // confirmed live in production for seo-specialist-ai (routed here by
    // the 'fastest' policy): "'messages' must contain the word 'json'...".
    // Without ever telling the model the schema, JSON mode also only
    // guarantees syntactically valid JSON, not the right shape. Build the
    // same explicit schema instruction anthropic-adapter.ts uses, which
    // satisfies both at once.
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature must match ProviderAdapter
  generateEmbeddings(input: EmbeddingInput): Promise<EmbeddingOutput> {
    return Promise.reject(
      new Error('Groq does not offer an embeddings API — route embedding tasks to OpenAI.'),
    );
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
      // Groq is priced far below OpenAI/Anthropic; real per-model rates
      // live in ai_models (Ch.14 §68).
      estimatedCostUsd:
        (estimatedPromptTokens / 1000) * 0.0002 + (estimatedCompletionTokens / 1000) * 0.0004,
    };
  }

  countTokens(text: string): number {
    return estimateTokenCount(text);
  }
}
