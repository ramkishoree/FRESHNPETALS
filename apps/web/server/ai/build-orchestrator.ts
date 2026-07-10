import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildAdapterRegistry } from './adapter-registry';
import { AiOrchestrator } from './orchestrator';
import { SupabaseAiGovernanceRepository } from './repositories/supabase-ai-governance-repository';
import { SupabaseAiModelRepository } from './repositories/supabase-ai-model-repository';
import { SupabaseAiPromptRepository } from './repositories/supabase-ai-prompt-repository';
import { SupabaseBusinessMemoryRepository } from './repositories/supabase-business-memory-repository';

/**
 * Wires the AiOrchestrator (Phase 6) to its real Supabase-backed
 * repositories and configured provider adapters. Every AI Employee run
 * (Phase 11) shares this one construction path rather than each call
 * site re-assembling the same five dependencies.
 */
export function buildAiOrchestrator(client: SupabaseClient): AiOrchestrator {
  return new AiOrchestrator({
    governanceRepo: new SupabaseAiGovernanceRepository(client),
    modelRepo: new SupabaseAiModelRepository(client),
    promptRepo: new SupabaseAiPromptRepository(client),
    memoryRepo: new SupabaseBusinessMemoryRepository(client),
    adapters: buildAdapterRegistry(),
  });
}
