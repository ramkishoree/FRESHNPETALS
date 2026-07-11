import { describe, expect, it } from 'vitest';
import {
  calculateCouponDiscount,
  computeDeliveryFee,
  computePricing,
  type CouponRecord,
  PER_KM_FEE,
  rankOutletsByDistance,
  STANDARD_DELIVERY_FEE,
  STANDARD_DELIVERY_KM,
  validateCartIsNotEmpty,
  validateCoupon,
} from './checkout';

function makeCoupon(overrides: Partial<CouponRecord> = {}): CouponRecord {
  return {
    code: 'WELCOME10',
    discountType: 'percentage',
    discountValue: 10,
    maxDiscountAmount: null,
    minCartValue: 0,
    startsAt: null,
    endsAt: null,
    active: true,
    timesUsed: 0,
    usageLimitTotal: null,
    ...overrides,
  };
}

describe('validateCartIsNotEmpty', () => {
  it('rejects an empty cart', () => {
    expect(validateCartIsNotEmpty([])).toHaveLength(1);
  });

  it('rejects a non-positive quantity', () => {
    expect(validateCartIsNotEmpty([{ productId: 'p1', quantity: 0 }])).toHaveLength(1);
  });

  it('accepts a normal cart', () => {
    expect(validateCartIsNotEmpty([{ productId: 'p1', quantity: 2 }])).toHaveLength(0);
  });
});

describe('computePricing', () => {
  it('charges standard delivery when no distance is provided', () => {
    const pricing = computePricing({
      lines: [{ productId: 'p1', sku: 'S1', name: 'A', quantity: 1, unitPrice: 500 }],
    });
    expect(pricing.subtotal).toBe(500);
    expect(pricing.deliveryFee).toBe(STANDARD_DELIVERY_FEE);
    expect(pricing.deliveryDistanceKm).toBeNull();
  });

  it('charges standard delivery when distance is within the base km', () => {
    const pricing = computePricing({
      lines: [{ productId: 'p1', sku: 'S1', name: 'A', quantity: 1, unitPrice: 500 }],
      deliveryDistanceKm: 3,
    });
    expect(pricing.deliveryFee).toBe(STANDARD_DELIVERY_FEE);
    expect(pricing.deliveryDistanceKm).toBe(3);
  });

  it('charges extra per km beyond the base distance', () => {
    // 10 km → first 5 km = ₹50, remaining 5 km × ₹5 = ₹25, total = ₹75
    const pricing = computePricing({
      lines: [{ productId: 'p1', sku: 'S1', name: 'A', quantity: 1, unitPrice: 500 }],
      deliveryDistanceKm: 10,
    });
    expect(pricing.deliveryFee).toBe(
      STANDARD_DELIVERY_FEE + Math.ceil(10 - STANDARD_DELIVERY_KM) * PER_KM_FEE,
    );
  });

  it('applies the coupon discount before computing tax', () => {
    const pricing = computePricing({
      lines: [{ productId: 'p1', sku: 'S1', name: 'A', quantity: 1, unitPrice: 1000 }],
      couponDiscount: 200,
    });
    expect(pricing.discountTotal).toBe(200);
    // Delivery is distance-based, always charged when distance not provided.
    expect(pricing.deliveryFee).toBe(STANDARD_DELIVERY_FEE);
  });

  it('never lets the coupon discount exceed the subtotal', () => {
    const pricing = computePricing({
      lines: [{ productId: 'p1', sku: 'S1', name: 'A', quantity: 1, unitPrice: 100 }],
      couponDiscount: 999,
    });
    expect(pricing.couponDiscount).toBe(100);
  });
});

describe('computeDeliveryFee', () => {
  it('returns the standard fee when distance is null or undefined', () => {
    expect(computeDeliveryFee(null)).toBe(STANDARD_DELIVERY_FEE);
    expect(computeDeliveryFee(undefined)).toBe(STANDARD_DELIVERY_FEE);
  });

  it('returns the standard fee for non-positive distance', () => {
    expect(computeDeliveryFee(0)).toBe(STANDARD_DELIVERY_FEE);
    expect(computeDeliveryFee(-1)).toBe(STANDARD_DELIVERY_FEE);
  });

  it('returns the standard fee within the base distance', () => {
    expect(computeDeliveryFee(1)).toBe(STANDARD_DELIVERY_FEE);
    expect(computeDeliveryFee(STANDARD_DELIVERY_KM)).toBe(STANDARD_DELIVERY_FEE);
  });

  it('charges extra per km beyond the base distance', () => {
    // 10 km → base 5 km = ₹50, extra 5 km × ₹5 = ₹25, total = ₹75
    expect(computeDeliveryFee(10)).toBe(75);
    // 7.3 km → base 5 km = ₹50, extra ceil(2.3) = 3 × ₹5 = ₹15, total = ₹65
    expect(computeDeliveryFee(7.3)).toBe(65);
  });
});

describe('validateCoupon', () => {
  const now = new Date('2026-06-01T00:00:00Z');

  it('rejects an inactive coupon', () => {
    expect(validateCoupon(makeCoupon({ active: false }), 1000, now).length).toBeGreaterThan(0);
  });

  it('rejects a coupon that has not started yet', () => {
    const violations = validateCoupon(makeCoupon({ startsAt: '2026-07-01T00:00:00Z' }), 1000, now);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('rejects an expired coupon', () => {
    const violations = validateCoupon(makeCoupon({ endsAt: '2026-05-01T00:00:00Z' }), 1000, now);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('rejects a cart below the minimum value', () => {
    const violations = validateCoupon(makeCoupon({ minCartValue: 2000 }), 1000, now);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('rejects a coupon that has hit its usage limit', () => {
    const violations = validateCoupon(makeCoupon({ usageLimitTotal: 5, timesUsed: 5 }), 1000, now);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('accepts a valid coupon', () => {
    expect(validateCoupon(makeCoupon(), 1000, now)).toHaveLength(0);
  });
});

describe('calculateCouponDiscount', () => {
  it('computes a percentage discount', () => {
    expect(
      calculateCouponDiscount(makeCoupon({ discountType: 'percentage', discountValue: 10 }), 1000),
    ).toBe(100);
  });

  it('caps a percentage discount at maxDiscountAmount', () => {
    expect(
      calculateCouponDiscount(
        makeCoupon({ discountType: 'percentage', discountValue: 50, maxDiscountAmount: 100 }),
        1000,
      ),
    ).toBe(100);
  });

  it('computes a fixed discount, capped at the subtotal', () => {
    expect(
      calculateCouponDiscount(makeCoupon({ discountType: 'fixed', discountValue: 5000 }), 1000),
    ).toBe(1000);
  });

  it('returns 0 for free_delivery/free_gift coupon types', () => {
    expect(calculateCouponDiscount(makeCoupon({ discountType: 'free_delivery' }), 1000)).toBe(0);
  });
});

describe('rankOutletsByDistance', () => {
  const lucknow = { lat: 26.8467, lon: 80.9462 };

  it('excludes inactive outlets', () => {
    const result = rankOutletsByDistance(
      [
        {
          id: 'o1',
          latitude: lucknow.lat,
          longitude: lucknow.lon,
          deliveryRadiusKm: 10,
          isActive: false,
        },
      ],
      lucknow.lat,
      lucknow.lon,
    );
    expect(result).toHaveLength(0);
  });

  it('excludes outlets outside their delivery radius', () => {
    // ~40km away — well outside a 5km radius.
    const result = rankOutletsByDistance(
      [{ id: 'far', latitude: 27.2, longitude: 81.3, deliveryRadiusKm: 5, isActive: true }],
      lucknow.lat,
      lucknow.lon,
    );
    expect(result).toHaveLength(0);
  });

  it('sorts eligible outlets nearest-first', () => {
    const result = rankOutletsByDistance(
      [
        { id: 'far', latitude: 26.9, longitude: 81.0, deliveryRadiusKm: 50, isActive: true },
        {
          id: 'near',
          latitude: lucknow.lat,
          longitude: lucknow.lon,
          deliveryRadiusKm: 50,
          isActive: true,
        },
      ],
      lucknow.lat,
      lucknow.lon,
    );
    expect(result[0]?.outlet.id).toBe('near');
    expect(result[1]?.outlet.id).toBe('far');
  });
});
