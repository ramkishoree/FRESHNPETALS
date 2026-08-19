import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/server/logger';

export interface StorefrontOutlet {
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  googlePlaceId: string | null;
  googleRating: number | null;
  googleRatingCount: number | null;
  workingHours: Record<string, string> | null;
}

const SELECT =
  'name, slug, address, city, state, latitude, longitude, phone, email, google_place_id, google_rating, google_rating_count, working_hours';

/**
 * The shops a customer can actually be served from.
 *
 * One definition, used by the shop pages, the sitemap and the
 * LocalBusiness structured data alike — a search engine being told about
 * a branch the storefront does not list is the kind of inconsistency
 * that costs a local ranking rather than earning one.
 *
 * Soft-deleted rows are excluded here rather than left to RLS: the admin
 * policy is permissive and `deleted_at` is the only reliable signal, the
 * same trap the inventory queries already document.
 */
export async function fetchOutlets(supabase: SupabaseClient): Promise<StorefrontOutlet[]> {
  const { data, error } = await supabase
    .from('outlets')
    .select(SELECT)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) {
    logger.error('outlets.fetch_failed', { message: error.message });
    return [];
  }

  return (data ?? []).map((row) => ({
    name: row.name as string,
    slug: row.slug as string,
    address: row.address as string,
    city: row.city as string,
    state: row.state as string,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    googlePlaceId: (row.google_place_id as string | null) ?? null,
    googleRating: row.google_rating != null ? Number(row.google_rating) : null,
    googleRatingCount: row.google_rating_count != null ? Number(row.google_rating_count) : null,
    workingHours:
      row.working_hours && Object.keys(row.working_hours as object).length > 0
        ? (row.working_hours as Record<string, string>)
        : null,
  }));
}

/**
 * A single national format for a number the admin stores however it was
 * typed — "7985430389" on one row, "07985430389" on another. Google
 * treats a `telephone` that disagrees between your site and your
 * Business Profile as a NAP inconsistency, so the shape has to be
 * decided in one place rather than per template.
 */
export function toE164(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  const local = digits.replace(/^0+/, '').replace(/^91(?=\d{10}$)/, '');
  return local.length === 10 ? `+91${local}` : `+${digits}`;
}

/** The area a shop is named for — "Gomti Nagar" out of its full address. */
export function outletArea(outlet: StorefrontOutlet): string {
  const fromName = outlet.name.split('-').pop()?.trim();
  return fromName && fromName.length > 1 ? fromName : outlet.city;
}

/**
 * What a shop's page is addressed by.
 *
 * Deliberately not `outlets.slug`. Those are internal handles typed in
 * the admin — "freshnpetalsgomtinagar1", trailing digit and all — and
 * the checkout's outlet API keys off them, so they cannot be renamed
 * without touching a payment path. A URL is read by people and weighed
 * by search engines, and "gomti-nagar" is the term being searched for;
 * "freshnpetalsgomtinagar1" is not a term at all.
 */
export function outletUrlSlug(outlet: StorefrontOutlet): string {
  return outletArea(outlet)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
