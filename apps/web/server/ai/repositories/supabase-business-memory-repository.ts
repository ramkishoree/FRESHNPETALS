import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeForPostgrestFilter } from '@/lib/postgrest-filter';

/**
 * Ch.14 §23: Business Memory Engine — "persists independently of any AI
 * provider." Semantic (embedding-based) retrieval is the eventual
 * production path (Ch.14 §25's Retrieval Engine) once real content and a
 * query-embedding call exist; this is a keyword-search implementation of
 * the same interface so the orchestrator's retrieval step is real today
 * rather than stubbed, and swappable later without touching its caller.
 */

export class SupabaseBusinessMemoryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async search(query: string, limit = 5): Promise<string[]> {
    const safeQuery = sanitizeForPostgrestFilter(query);
    if (!safeQuery) return [];

    const { data, error } = await this.client
      .from('business_memory')
      .select('content')
      .eq('approved', true)
      .or(`title.ilike.%${safeQuery}%,content.ilike.%${safeQuery}%`)
      .order('importance', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => row.content as string);
  }
}
