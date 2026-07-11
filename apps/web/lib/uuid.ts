/**
 * PostgreSQL's uuid type accepts any 32‑hex‑character UUID in the standard
 * 8‑4‑4‑4‑12 format, including version‑0 (seed data like
 * `00000000‑0000‑0000‑0000‑000000000301`), version‑7 (`uuid_generate_v7()`
 * — the products table default), and standard v4.
 *
 * Zod v4's `z.string().uuid()` is stricter: it rejects version‑0 (except
 * the nil UUID) and versions outside 1–8. Since we can't control what
 * version the database generates, we use this permissive regex to match
 * what PostgreSQL actually accepts — keeping the cart, API validation, and
 * database in agreement.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Drop‑in replacement for `z.string().uuid()` that uses the permissive
 * regex above instead of Zod v4's stricter version‑aware validator.
 *
 * ```ts
 * // Before (rejected uuid_generate_v7() and seed data):
 * productId: z.string().uuid(),
 *
 * // After (matches what PostgreSQL accepts):
 * productId: zUuid(),
 * ```
 */
import { z } from 'zod';

export function zUuid(): z.ZodString {
  return z.string().regex(UUID_RE, 'Invalid UUID format (must be 8-4-4-4-12 hex)');
}
