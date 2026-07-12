import 'server-only';
import { DEFAULT_RATE_CONFIG, type RateConfig } from '@prana/commerce';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/server/logger';

const SETTINGS_KEYS = [
  'tax_rate_percent',
  'delivery_base_fee_inr',
  'delivery_base_km',
  'delivery_per_km_fee_inr',
] as const;

/**
 * Migration 0049 seeded these four system_settings rows explicitly
 * documented as "not yet read from here" — the admin Settings page could
 * edit tax_rate_percent/delivery_base_fee_inr/etc. and it changed nothing
 * about what a customer was actually charged. This is that missing read
 * side: real checkout pricing (start-checkout.ts, preview-pricing.ts) now
 * calls this before computePricing instead of using packages/commerce's
 * hardcoded constants directly. Falls back to DEFAULT_RATE_CONFIG per-key
 * if a row is missing or malformed, rather than failing checkout outright
 * over a settings-table hiccup — pricing must never go down because an
 * admin setting is momentarily unreadable.
 */
export async function getRateConfig(admin: SupabaseClient): Promise<RateConfig> {
  const { data, error } = await admin
    .from('system_settings')
    .select('key, value')
    .in('key', SETTINGS_KEYS);

  if (error || !data) {
    logger.warn('checkout.rate_config.fetch_failed', { message: error?.message });
    return DEFAULT_RATE_CONFIG;
  }

  const values = new Map(data.map((row) => [row.key, row.value as unknown]));
  const num = (key: (typeof SETTINGS_KEYS)[number], fallback: number): number => {
    const raw = values.get(key);
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
  };

  return {
    taxRate: num('tax_rate_percent', DEFAULT_RATE_CONFIG.taxRate * 100) / 100,
    standardDeliveryKm: num('delivery_base_km', DEFAULT_RATE_CONFIG.standardDeliveryKm),
    standardDeliveryFee: num('delivery_base_fee_inr', DEFAULT_RATE_CONFIG.standardDeliveryFee),
    perKmFee: num('delivery_per_km_fee_inr', DEFAULT_RATE_CONFIG.perKmFee),
  };
}
