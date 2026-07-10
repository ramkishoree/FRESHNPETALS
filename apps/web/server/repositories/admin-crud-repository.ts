import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeForPostgrestFilter } from '@/lib/postgrest-filter';

export interface AdminCrudListParams {
  limit: number;
  cursor?: string;
  search?: string;
  filters?: Record<string, string>;
}

export interface AdminCrudListResult<TRow> {
  items: TRow[];
  nextCursor: string | null;
}

/**
 * Ch.16 §100-106: a dozen+ admin resources (categories, collections,
 * outlets, delivery slots, coupons, offers, announcements, blogs, static
 * pages, notifications) share the exact same shape — list/get/create/
 * update/soft-delete behind admin-only RLS, audited on every write. None
 * of them carry business rules beyond "an administrator changed this
 * row" (unlike Products/Inventory/Orders, which get bespoke
 * packages/commerce services for their real state machines). Ch.11 §5's
 * layer split exists to protect business logic from infrastructure —
 * these resources have none to protect, so one generic repository here
 * is more honest than a dozen near-identical one-line wrapper classes.
 *
 * Every table this is used against must have `id`, `created_at`,
 * `deleted_at` (nullable) columns — soft delete sets `deleted_at`, it
 * never issues a real DELETE (Ch.10 §35 Soft Delete Policy).
 */
export class AdminCrudRepository<TRow extends { id: string }> {
  constructor(
    private readonly client: SupabaseClient,
    private readonly table: string,
    private readonly selectColumns = '*',
    private readonly searchColumns: readonly string[] = [],
  ) {}

  async findById(id: string): Promise<TRow | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select(this.selectColumns)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as TRow | null) ?? null;
  }

  async list(params: AdminCrudListParams): Promise<AdminCrudListResult<TRow>> {
    let query = this.client
      .from(this.table)
      .select(this.selectColumns)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(params.limit);

    for (const [column, value] of Object.entries(params.filters ?? {})) {
      query = query.eq(column, value);
    }

    if (params.search && this.searchColumns.length > 0) {
      const safeSearch = sanitizeForPostgrestFilter(params.search);
      if (safeSearch) {
        const clause = this.searchColumns
          .map((column) => `${column}.ilike.%${safeSearch}%`)
          .join(',');
        query = query.or(clause);
      }
    }

    if (params.cursor) query = query.lt('created_at', params.cursor);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data as unknown as (TRow & { created_at: string })[]) ?? [];
    const nextCursor = rows.length === params.limit ? (rows.at(-1)?.created_at ?? null) : null;
    return { items: rows, nextCursor };
  }

  async create(input: Record<string, unknown>): Promise<TRow> {
    const { data, error } = await this.client
      .from(this.table)
      .insert(input)
      .select(this.selectColumns)
      .single();
    if (error) throw new Error(error.message);
    return data as unknown as TRow;
  }

  async update(id: string, input: Record<string, unknown>): Promise<TRow> {
    const { data, error } = await this.client
      .from(this.table)
      .update(input)
      .eq('id', id)
      .select(this.selectColumns)
      .single();
    if (error) throw new Error(error.message);
    return data as unknown as TRow;
  }

  async softDelete(id: string, actorId?: string): Promise<void> {
    const { error } = await this.client
      .from(this.table)
      .update({
        deleted_at: new Date().toISOString(),
        ...(actorId ? { updated_by: actorId } : {}),
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
}
