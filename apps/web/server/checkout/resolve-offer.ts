import 'server-only';
import { calculateOfferDiscount, selectBestOffer, type OfferRecord } from '@prana/commerce';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ResolvedOffer {
  offerDiscount: number;
  freeDeliveryFromOffer: boolean;
}

interface OfferRow {
  id: string;
  offer_type: OfferRecord['offerType'];
  priority: number;
  conditions: OfferRecord['conditions'] | null;
  reward: OfferRecord['reward'] | null;
}

/**
 * Ch.8 §69-72 Offer Engine — shared by both the real checkout and the
 * pricing preview so they can never disagree about which offer applies.
 * Only ever queries `active = true` offers still within their date
 * window; `selectBestOffer` (packages/commerce) picks the single
 * highest-priority one that's actually eligible for this cart.
 */
export async function resolveActiveOffer(
  admin: SupabaseClient,
  cartSubtotal: number,
  cartProductIds: string[],
  cartCategoryIds: string[],
): Promise<ResolvedOffer> {
  const nowIso = new Date().toISOString();
  const { data: offerRows } = await admin
    .from('offers')
    .select('id, offer_type, priority, conditions, reward')
    .eq('active', true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`);

  const offers: OfferRecord[] = ((offerRows ?? []) as OfferRow[]).map((row) => ({
    id: row.id,
    offerType: row.offer_type,
    priority: row.priority,
    conditions: row.conditions ?? {},
    reward: row.reward ?? {},
  }));

  const best = selectBestOffer(offers, cartSubtotal, cartProductIds, cartCategoryIds);
  if (!best) return { offerDiscount: 0, freeDeliveryFromOffer: false };

  return {
    offerDiscount: calculateOfferDiscount(best, cartSubtotal),
    freeDeliveryFromOffer: best.offerType === 'free_delivery',
  };
}
