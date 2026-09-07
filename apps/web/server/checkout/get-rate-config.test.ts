// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_RATE_CONFIG } from '@prana/commerce';
import { getRateConfig } from './get-rate-config';

function makeAdmin(
  rows: { key: string; value: unknown }[] | null,
  error: { message: string } | null = null,
) {
  const from = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: rows, error }),
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from } as any;
}

describe('getRateConfig', () => {
  it('reads real admin-edited values from system_settings', async () => {
    const admin = makeAdmin([
      { key: 'tax_rate_percent', value: 8 },
      { key: 'delivery_base_fee_inr', value: 60 },
      { key: 'delivery_base_km', value: 4 },
      { key: 'delivery_per_km_fee_inr', value: 6 },
      { key: 'night_charge_inr', value: 120 },
      { key: 'night_charge_after_time', value: '21:00' },
    ]);

    const rates = await getRateConfig(admin);

    expect(rates).toEqual({
      taxRate: 0.08,
      standardDeliveryKm: 4,
      standardDeliveryFee: 60,
      perKmFee: 6,
      nightChargeFee: 120,
      nightChargeAfterTime: '21:00',
    });
  });

  it('falls back to defaults when the settings query errors', async () => {
    const admin = makeAdmin(null, { message: 'db unavailable' });

    const rates = await getRateConfig(admin);

    expect(rates.taxRate).toBe(0.05);
    expect(rates.standardDeliveryFee).toBe(50);
  });

  it('falls back per-key when a row is missing or malformed, not the whole config', async () => {
    const admin = makeAdmin([
      { key: 'tax_rate_percent', value: 10 },
      { key: 'delivery_base_fee_inr', value: 'not-a-number' },
    ]);

    const rates = await getRateConfig(admin);

    expect(rates.taxRate).toBe(0.1);
    // Against DEFAULT_RATE_CONFIG rather than copies of its numbers: a
    // hardcoded 5 here went stale when the shop moved to ₹10/km, so the
    // test kept asserting a fallback rate that no longer existed.
    expect(rates.standardDeliveryFee).toBe(DEFAULT_RATE_CONFIG.standardDeliveryFee);
    expect(rates.standardDeliveryKm).toBe(DEFAULT_RATE_CONFIG.standardDeliveryKm);
    expect(rates.perKmFee).toBe(DEFAULT_RATE_CONFIG.perKmFee);
  });

  it('never invents a night charge from a malformed cutoff', () => {
    // A bad settings row must fall back to "no surcharge", not to some
    // arbitrary time that starts charging people.
    return (async () => {
      const admin = makeAdmin([{ key: 'night_charge_after_time', value: 'evening' }]);
      const rates = await getRateConfig(admin);
      expect(rates.nightChargeFee).toBe(0);
      expect(rates.nightChargeAfterTime).toBe('20:00');
    })();
  });
});
