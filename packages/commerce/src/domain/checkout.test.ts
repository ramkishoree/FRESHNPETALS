import { describe, expect, it } from 'vitest';
import {
  calculateCouponDiscount,
  calculateOfferDiscount,
  computeDeliveryFee,
  computePricing,
  isNightSlot,
  DEFAULT_RATE_CONFIG,
  type CouponRecord,
  isOfferEligible,
  type OfferRecord,
  PER_KM_FEE,
  rankOutletsByDistance,
  resolveOfferBonusItem,
  selectBestOffer,
  STANDARD_DELIVERY_FEE,
  STANDARD_DELIVERY_KM,
  validateCartIsNotEmpty,
  validateCoupon,
} from './checkout';

function makeOffer(overrides: Partial<OfferRecord> = {}): OfferRecord {
  return {
    id: 'offer-1',
    offerType: 'percentage',
    priority: 6,
    conditions: {},
    reward: { discountValue: 10 },
    ...overrides,
  };
}

function makeCoupon(overrides: Partial<CouponRecord> = {}): CouponRecord {
  return {
    code: 'WELCOME10',
    discountType: 'percentage',
    discountValue: 10,
    maxDiscountAmount: null,
    minCartValue: 0,
    eligibilityType: 'general',
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

  it('rejects a first_order coupon for a customer who has already ordered', () => {
    const coupon = makeCoupon({ eligibilityType: 'first_order' });
    const violations = validateCoupon(coupon, 1000, now, { customerOrderCount: 2 });
    expect(violations.length).toBeGreaterThan(0);
  });

  it('accepts a first_order coupon for a customer with zero prior orders', () => {
    const coupon = makeCoupon({ eligibilityType: 'first_order' });
    expect(validateCoupon(coupon, 1000, now, { customerOrderCount: 0 })).toHaveLength(0);
    // Omitted entirely defaults to 0 too (guest/unknown context).
    expect(validateCoupon(coupon, 1000, now)).toHaveLength(0);
  });

  it('rejects a birthday coupon when the customer has no date of birth on file', () => {
    const coupon = makeCoupon({ eligibilityType: 'birthday' });
    const violations = validateCoupon(coupon, 1000, now, { customerDateOfBirth: null });
    expect(violations.length).toBeGreaterThan(0);
  });

  it("rejects a birthday coupon outside the customer's birthday month", () => {
    // `now` is June 2026; a March birthday should not qualify.
    const coupon = makeCoupon({ eligibilityType: 'birthday' });
    const violations = validateCoupon(coupon, 1000, now, {
      customerDateOfBirth: '1995-03-15',
    });
    expect(violations.length).toBeGreaterThan(0);
  });

  it("accepts a birthday coupon during the customer's birthday month", () => {
    const coupon = makeCoupon({ eligibilityType: 'birthday' });
    const violations = validateCoupon(coupon, 1000, now, {
      customerDateOfBirth: '1995-06-15',
    });
    expect(violations).toHaveLength(0);
  });

  it('has no extra eligibility gate for corporate/influencer/employee coupons', () => {
    for (const eligibilityType of ['corporate', 'influencer', 'employee'] as const) {
      expect(validateCoupon(makeCoupon({ eligibilityType }), 1000, now)).toHaveLength(0);
    }
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

describe('isOfferEligible', () => {
  it('rejects a cart below the offer minimum', () => {
    const offer = makeOffer({ conditions: { minCartValue: 1000 } });
    expect(isOfferEligible(offer, 500, [], [])).toBe(false);
    expect(isOfferEligible(offer, 1000, [], [])).toBe(true);
  });

  it('requires at least one matching product when productIds is set', () => {
    const offer = makeOffer({ conditions: { productIds: ['p1', 'p2'] } });
    expect(isOfferEligible(offer, 0, ['p3'], [])).toBe(false);
    expect(isOfferEligible(offer, 0, ['p1'], [])).toBe(true);
  });

  it('requires at least one matching category when categoryIds is set', () => {
    const offer = makeOffer({ conditions: { categoryIds: ['c1'] } });
    expect(isOfferEligible(offer, 0, [], ['c2'])).toBe(false);
    expect(isOfferEligible(offer, 0, [], ['c1'])).toBe(true);
  });

  it('has no conditions to fail when none are configured', () => {
    expect(isOfferEligible(makeOffer({ conditions: {} }), 0, [], [])).toBe(true);
  });

  it('rejects a buy_x_get_y offer when the cart has fewer than buyQuantity of buyProductId', () => {
    const offer = makeOffer({
      offerType: 'buy_x_get_y',
      reward: { buyProductId: 'p1', buyQuantity: 2, getQuantity: 1 },
    });
    expect(isOfferEligible(offer, 0, ['p1'], [], { p1: 1 })).toBe(false);
    expect(isOfferEligible(offer, 0, ['p1'], [], { p1: 2 })).toBe(true);
    expect(isOfferEligible(offer, 0, ['p1'], [], { p1: 5 })).toBe(true);
  });

  it('rejects a buy_x_get_y offer with no buyProductId configured', () => {
    const offer = makeOffer({ offerType: 'buy_x_get_y', reward: { buyQuantity: 2 } });
    expect(isOfferEligible(offer, 0, [], [], { p1: 10 })).toBe(false);
  });

  it('rejects a free_gift offer with no giftProductId configured', () => {
    const offer = makeOffer({ offerType: 'free_gift', reward: {} });
    expect(isOfferEligible(offer, 1000, [], [])).toBe(false);
  });

  it('accepts a free_gift offer with a giftProductId once the cart minimum is met', () => {
    const offer = makeOffer({
      offerType: 'free_gift',
      conditions: { minCartValue: 999 },
      reward: { giftProductId: 'gift-1' },
    });
    expect(isOfferEligible(offer, 500, [], [])).toBe(false);
    expect(isOfferEligible(offer, 999, [], [])).toBe(true);
  });
});

describe('selectBestOffer', () => {
  it('returns null when nothing is eligible', () => {
    const offer = makeOffer({ conditions: { minCartValue: 5000 } });
    expect(selectBestOffer([offer], 100, [], [])).toBeNull();
  });

  it('picks the lower-priority-number (higher precedence) offer per Ch.8 §72', () => {
    const low = makeOffer({ id: 'flash-sale', priority: 2 });
    const high = makeOffer({ id: 'automatic-promo', priority: 6 });
    expect(selectBestOffer([high, low], 1000, [], [])?.id).toBe('flash-sale');
  });

  it('lets a higher-priority buy_x_get_y offer beat a lower-priority percentage offer — one winner overall, not one per type', () => {
    const bogo = makeOffer({
      id: 'bogo',
      offerType: 'buy_x_get_y',
      priority: 1,
      reward: { buyProductId: 'p1', buyQuantity: 1, getQuantity: 1 },
    });
    const percentageOffer = makeOffer({
      id: 'percentage-offer',
      offerType: 'percentage',
      priority: 6,
    });
    const winner = selectBestOffer([bogo, percentageOffer], 1000, ['p1'], [], { p1: 1 });
    expect(winner?.id).toBe('bogo');
  });

  it('skips an ineligible buy_x_get_y offer (not enough qualifying units) even at top priority', () => {
    const bogo = makeOffer({
      id: 'bogo',
      offerType: 'buy_x_get_y',
      priority: 1,
      reward: { buyProductId: 'p1', buyQuantity: 3, getQuantity: 1 },
    });
    const percentageOffer = makeOffer({
      id: 'percentage-offer',
      offerType: 'percentage',
      priority: 6,
    });
    const winner = selectBestOffer([bogo, percentageOffer], 1000, ['p1'], [], { p1: 1 });
    expect(winner?.id).toBe('percentage-offer');
  });
});

describe('calculateOfferDiscount', () => {
  it('applies a percentage offer capped at maxDiscountAmount', () => {
    const offer = makeOffer({
      offerType: 'percentage',
      reward: { discountValue: 20, maxDiscountAmount: 100 },
    });
    expect(calculateOfferDiscount(offer, 1000)).toBe(100);
    expect(calculateOfferDiscount(offer, 300)).toBe(60);
  });

  it('applies a fixed offer capped at the cart subtotal', () => {
    const offer = makeOffer({ offerType: 'fixed', reward: { discountValue: 200 } });
    expect(calculateOfferDiscount(offer, 1000)).toBe(200);
    expect(calculateOfferDiscount(offer, 100)).toBe(100);
  });

  it('contributes 0 to the discount line for free_delivery — it zeroes the fee instead', () => {
    expect(calculateOfferDiscount(makeOffer({ offerType: 'free_delivery' }), 1000)).toBe(0);
  });

  it('contributes 0 to the discount line for buy_x_get_y/free_gift — they grant a bonus item instead', () => {
    expect(
      calculateOfferDiscount(
        makeOffer({ offerType: 'buy_x_get_y', reward: { buyProductId: 'p1', buyQuantity: 2 } }),
        1000,
      ),
    ).toBe(0);
    expect(
      calculateOfferDiscount(
        makeOffer({ offerType: 'free_gift', reward: { giftProductId: 'g1' } }),
        1000,
      ),
    ).toBe(0);
  });
});

describe('resolveOfferBonusItem', () => {
  it('resolves a buy_x_get_y bonus, defaulting getQuantity to 1', () => {
    const offer = makeOffer({
      offerType: 'buy_x_get_y',
      reward: { buyProductId: 'p1', buyQuantity: 2 },
    });
    expect(resolveOfferBonusItem(offer)).toEqual({ productId: 'p1', quantity: 1 });
  });

  it('resolves a buy_x_get_y bonus with an explicit getQuantity', () => {
    const offer = makeOffer({
      offerType: 'buy_x_get_y',
      reward: { buyProductId: 'p1', buyQuantity: 2, getQuantity: 3 },
    });
    expect(resolveOfferBonusItem(offer)).toEqual({ productId: 'p1', quantity: 3 });
  });

  it('resolves a free_gift bonus, defaulting giftQuantity to 1', () => {
    const offer = makeOffer({ offerType: 'free_gift', reward: { giftProductId: 'gift-1' } });
    expect(resolveOfferBonusItem(offer)).toEqual({ productId: 'gift-1', quantity: 1 });
  });

  it('returns null for percentage/fixed/free_delivery — they have no bonus item', () => {
    expect(resolveOfferBonusItem(makeOffer({ offerType: 'percentage' }))).toBeNull();
    expect(resolveOfferBonusItem(makeOffer({ offerType: 'fixed' }))).toBeNull();
    expect(resolveOfferBonusItem(makeOffer({ offerType: 'free_delivery' }))).toBeNull();
  });

  it('returns null for a buy_x_get_y/free_gift offer missing its product id', () => {
    expect(resolveOfferBonusItem(makeOffer({ offerType: 'buy_x_get_y', reward: {} }))).toBeNull();
    expect(resolveOfferBonusItem(makeOffer({ offerType: 'free_gift', reward: {} }))).toBeNull();
  });
});

describe('computePricing with an offer applied', () => {
  const lines = [{ productId: 'p1', sku: 'SKU1', name: 'Rose', quantity: 1, unitPrice: 1000 }];

  it('combines coupon and offer discounts, capped at the subtotal', () => {
    const result = computePricing({ lines, couponDiscount: 800, offerDiscount: 500 });
    expect(result.discountTotal).toBe(1000);
    expect(result.couponDiscount).toBe(800);
    expect(result.offerDiscount).toBe(500);
  });

  it('zeroes the delivery fee when freeDeliveryFromOffer is true, ignoring distance', () => {
    const result = computePricing({ lines, deliveryDistanceKm: 20, freeDeliveryFromOffer: true });
    expect(result.deliveryFee).toBe(0);
  });
});

describe('night delivery charge', () => {
  const NIGHT_RATES = {
    ...DEFAULT_RATE_CONFIG,
    nightChargeFee: 100,
    nightChargeAfterTime: '20:00',
  };
  const line = { productId: 'p1', sku: 'S1', name: 'A', quantity: 1, unitPrice: 500 };

  it('is not charged by default — a surcharge must never appear unasked', () => {
    // DEFAULT_RATE_CONFIG ships with the fee at 0, so an install that
    // never configures one can't silently overcharge.
    const pricing = computePricing({ lines: [line], deliverySlotStartTime: '22:00' });
    expect(pricing.nightCharge).toBe(0);
  });

  it('applies to a slot starting after the cutoff', () => {
    const pricing = computePricing({
      lines: [line],
      deliverySlotStartTime: '21:00',
      rates: NIGHT_RATES,
    });
    expect(pricing.nightCharge).toBe(100);
  });

  it('applies to a slot starting exactly at the cutoff', () => {
    // "from 8 PM" has to include the 8 PM slot, or the boundary slot is
    // free and the one after it costs extra.
    const pricing = computePricing({
      lines: [line],
      deliverySlotStartTime: '20:00',
      rates: NIGHT_RATES,
    });
    expect(pricing.nightCharge).toBe(100);
  });

  it('does not apply to a slot before the cutoff', () => {
    const pricing = computePricing({
      lines: [line],
      deliverySlotStartTime: '19:59',
      rates: NIGHT_RATES,
    });
    expect(pricing.nightCharge).toBe(0);
  });

  it('does not apply when no slot has been picked yet', () => {
    const pricing = computePricing({ lines: [line], rates: NIGHT_RATES });
    expect(pricing.nightCharge).toBe(0);
  });

  it('lands in the grand total exactly once', () => {
    const withoutNight = computePricing({
      lines: [line],
      deliverySlotStartTime: '10:00',
      rates: NIGHT_RATES,
    });
    const withNight = computePricing({
      lines: [line],
      deliverySlotStartTime: '21:00',
      rates: NIGHT_RATES,
    });
    expect(withNight.grandTotal - withoutNight.grandTotal).toBe(100);
  });

  it('does not change the tax, which is on the goods', () => {
    const withoutNight = computePricing({
      lines: [line],
      deliverySlotStartTime: '10:00',
      rates: NIGHT_RATES,
    });
    const withNight = computePricing({
      lines: [line],
      deliverySlotStartTime: '21:00',
      rates: NIGHT_RATES,
    });
    expect(withNight.taxTotal).toBe(withoutNight.taxTotal);
  });

  it('still applies when an offer made delivery free', () => {
    // Free delivery covers the fee, not the cost of going out at night.
    const pricing = computePricing({
      lines: [line],
      deliverySlotStartTime: '21:00',
      freeDeliveryFromOffer: true,
      rates: NIGHT_RATES,
    });
    expect(pricing.deliveryFee).toBe(0);
    expect(pricing.nightCharge).toBe(100);
  });

  it('refuses to charge on an unparseable slot time', () => {
    // Failing to charge is recoverable; charging unexpectedly is not.
    for (const bad of ['', 'evening', '25:00', '20-00']) {
      expect(isNightSlot(bad, '20:00')).toBe(false);
    }
  });

  it('handles a single-digit hour, which "9:00" from a slot label is', () => {
    expect(isNightSlot('9:00', '20:00')).toBe(false);
    expect(isNightSlot('21:00', '9:00')).toBe(true);
  });
});
