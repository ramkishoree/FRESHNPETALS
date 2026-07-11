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
import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MAX_TOKENS = 1024;

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

// Claude routinely wraps JSON in a ```json ... ``` fence despite an explicit
// "no markdown fences" instruction — a prompt instruction alone isn't
// reliable (unlike OpenAI/Groq's real response_format: json_object mode).
// Strip a fence if present before parsing, rather than trusting the model.
export function stripMarkdownFence(raw: string): string {
  const match = raw.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return match?.[1] ? match[1].trim() : raw;
}

/**
 * Ch.14 §7/§8: the only file allowed to import the `@anthropic-ai/sdk`
 * package. Claude has no native JSON-schema response mode (unlike OpenAI's
 * `response_format`) — structured output here is a system-prompt
 * instruction + JSON.parse, a documented v1 simplification. Anthropic's
 * forced-tool-use pattern is the more robust approach and can replace this
 * once a concrete schema shape is needed (Phase 11).
 */
export class AnthropicAdapter implements ProviderAdapter {
  readonly providerName = 'anthropic';
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const response = await this.client.messages.create({
      model: input.model,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(input.systemPrompt ? { system: input.systemPrompt } : {}),
      ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      messages: input.messages,
    });

    return {
      text: extractText(response.content),
      promptTokens: response.usage.input_tokens ?? 0,
      completionTokens: response.usage.output_tokens,
    };
  }

  async generateStructuredOutput<T>(
    input: StructuredOutputInput,
  ): Promise<StructuredOutputOutput<T>> {
    const schemaInstruction = `Respond with ONLY valid JSON matching this schema, no prose, no markdown fences:\n${JSON.stringify(input.jsonSchema)}`;
    const system = input.systemPrompt
      ? `${input.systemPrompt}\n\n${schemaInstruction}`
      : schemaInstruction;

    const response = await this.client.messages.create({
      model: input.model,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      system,
      ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      messages: input.messages,
    });

    const raw = stripMarkdownFence(extractText(response.content).trim());
    return {
      data: JSON.parse(raw) as T,
      promptTokens: response.usage.input_tokens ?? 0,
      completionTokens: response.usage.output_tokens,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature must match ProviderAdapter
  generateEmbeddings(input: EmbeddingInput): Promise<EmbeddingOutput> {
    return Promise.reject(
      new Error('Anthropic does not offer an embeddings API — route embedding tasks to OpenAI.'),
    );
  }

  async checkHealth(): Promise<ProviderHealth> {
    const startedAt = Date.now();
    try {
      await this.client.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
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
    const estimatedCompletionTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;
    return {
      estimatedPromptTokens,
      estimatedCompletionTokens,
      // Real per-model rates live in ai_models (Ch.14 §68).
      estimatedCostUsd:
        (estimatedPromptTokens / 1000) * 0.003 + (estimatedCompletionTokens / 1000) * 0.015,
    };
  }

  countTokens(text: string): number {
    return estimateTokenCount(text);
  }
}
