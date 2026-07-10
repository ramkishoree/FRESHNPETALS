import type { ProviderAdapter } from '@prana/ai';
import { getServerEnv } from '@/config/env';
import { AnthropicAdapter } from './adapters/anthropic-adapter';
import { GroqAdapter } from './adapters/groq-adapter';
import { OpenAiAdapter } from './adapters/openai-adapter';

/**
 * Builds the provider → adapter map from whichever v1 provider (Ch.14 §9:
 * OpenAI, Anthropic, Groq) keys are actually configured. A provider with
 * no key simply isn't in the map — the orchestrator's
 * `provider_not_configured` error path handles that, rather than the app
 * failing to boot because one key is missing.
 */
export function buildAdapterRegistry(): Record<string, ProviderAdapter> {
  const env = getServerEnv();
  const registry: Record<string, ProviderAdapter> = {};

  if (env.OPENAI_API_KEY) registry['openai'] = new OpenAiAdapter(env.OPENAI_API_KEY);
  if (env.ANTHROPIC_API_KEY) registry['anthropic'] = new AnthropicAdapter(env.ANTHROPIC_API_KEY);
  if (env.GROQ_API_KEY) registry['groq'] = new GroqAdapter(env.GROQ_API_KEY);

  return registry;
}
