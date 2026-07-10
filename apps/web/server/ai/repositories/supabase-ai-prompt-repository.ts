import type { SupabaseClient } from '@supabase/supabase-js';

export interface PublishedPromptVersion {
  promptId: string;
  version: number;
  modelFamily: string | null;
  systemPrompt: string;
  developerPrompt: string | null;
  expectedOutputSchema: unknown;
}

/**
 * Ch.14 §19/§20: prompts are managed centrally and immutable once
 * published; "Only published prompts are available to production." This
 * repository only ever reads the currently-published version — there is
 * deliberately no method here to fetch a draft/deprecated version for
 * production execution.
 */
export class SupabaseAiPromptRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getPublishedVersion(promptName: string): Promise<PublishedPromptVersion | null> {
    const { data: prompt, error: promptError } = await this.client
      .from('ai_prompts')
      .select('id, current_version, status')
      .eq('name', promptName)
      .eq('status', 'published')
      .maybeSingle();

    if (promptError) throw new Error(promptError.message);
    if (!prompt) return null;

    const { data: version, error: versionError } = await this.client
      .from('ai_prompt_versions')
      .select(
        'prompt_id, version, model_family, system_prompt, developer_prompt, expected_output_schema',
      )
      .eq('prompt_id', prompt.id)
      .eq('version', prompt.current_version)
      .maybeSingle();

    if (versionError) throw new Error(versionError.message);
    if (!version) return null;

    return {
      promptId: version.prompt_id as string,
      version: version.version as number,
      modelFamily: version.model_family as string | null,
      systemPrompt: version.system_prompt as string,
      developerPrompt: version.developer_prompt as string | null,
      expectedOutputSchema: version.expected_output_schema,
    };
  }
}
