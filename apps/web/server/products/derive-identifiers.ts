import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { slugify } from '@/lib/slugify';

/**
 * Slug and SKU, derived from the product name instead of typed.
 *
 * Both were required fields on the admin form, and both are things a
 * florist should never have to think about: one is a URL detail, the
 * other an inventory code nobody was using as anything but a formality.
 * Getting either wrong is invisible until a link 404s or a code
 * collides, which is exactly the kind of chore worth removing.
 *
 * Uniqueness is checked against the table rather than assumed, because
 * "Red Roses" and "Red roses" slugify identically and both columns are
 * unique — a collision would surface as a raw Postgres error at save
 * time. A numeric suffix is appended until the value is free.
 */
async function isTaken(
  admin: SupabaseClient,
  column: 'slug' | 'sku',
  value: string,
  excludeId?: string,
): Promise<boolean> {
  let query = admin.from('products').select('id').eq(column, value).limit(1);
  if (excludeId) query = query.neq('id', excludeId);
  const { data } = await query;
  return (data?.length ?? 0) > 0;
}

async function firstFree(
  admin: SupabaseClient,
  column: 'slug' | 'sku',
  base: string,
  excludeId?: string,
): Promise<string> {
  if (!(await isTaken(admin, column, base, excludeId))) return base;
  // Bounded rather than while(true): a runaway loop here would hang a
  // product save. 50 collisions on one name means something else is
  // wrong, and the timestamp fallback is still unique.
  for (let suffix = 2; suffix <= 50; suffix++) {
    const candidate = `${base}-${suffix}`;
    if (!(await isTaken(admin, column, candidate, excludeId))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function deriveSlug(
  admin: SupabaseClient,
  name: string,
  excludeId?: string,
): Promise<string> {
  // A name of only punctuation or non-Latin script slugifies to nothing,
  // which would produce an unroutable empty slug.
  const base = slugify(name) || `product-${Date.now().toString(36)}`;
  return firstFree(admin, 'slug', base, excludeId);
}

export async function deriveSku(
  admin: SupabaseClient,
  name: string,
  excludeId?: string,
): Promise<string> {
  const words = slugify(name).split('-').filter(Boolean);
  const initials = words
    .slice(0, 3)
    .map((word) => word.slice(0, 3).toUpperCase())
    .join('-');
  const base = `FNP-${initials || 'ITEM'}`;
  return firstFree(admin, 'sku', base, excludeId);
}
