/**
 * Ch.11 §6: "Every aggregate owns a repository. Repositories expose
 * interfaces. Infrastructure provides implementations. Domain never
 * imports Supabase SDK directly." Concrete repository interfaces (e.g.
 * packages/commerce's ProductRepository) extend this with their
 * aggregate-specific methods; base coverage is read-only because write
 * shapes vary too much per aggregate to generalize usefully.
 *
 * Multi-step writes that must be atomic (Ch.11 §8's "Create Order: BEGIN →
 * reserve inventory → create payment → create order → COMMIT") are NOT
 * expressed as several sequential repository calls — every Supabase
 * client call is its own PostgREST request/transaction, so JS-level
 * sequencing gives no atomicity guarantee at all. Those go through a
 * single Postgres function call (`.rpc(...)`), where BEGIN/COMMIT/
 * ROLLBACK is the function body's native transaction. A repository method
 * that wraps such an RPC is still "the repository", it just calls one
 * database function instead of building a query.
 */

export interface Pagination {
  limit: number;
  cursor?: string;
}

export interface PagedResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ReadRepository<T, TId = string> {
  findById(id: TId): Promise<T | null>;
  findMany(pagination: Pagination): Promise<PagedResult<T>>;
}
