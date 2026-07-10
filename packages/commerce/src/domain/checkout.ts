/** Ch.8 §88-97 Checkout Domain. */

export interface CartLineInput {
  productId: string;
  quantity: number;
}

export interface CheckoutAddressInput {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
}

export interface ValidatedCartLine {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface PricingBreakdown {
  subtotal: number;
  discountTotal: number;
  couponDiscount: number;
  deliveryFee: number;
  taxTotal: number;
  grandTotal: number;
}

/** Ch.8 §81 Tax Engine — a flat rate stands in for the real GST slab table (Ch.8 §82 "Future Tax Support") until product-level tax categories exist. */
export const TAX_RATE = 0.05;
/** Ch.12 §25 Free Delivery Progress example ("Spend ₹240 more"). */
export const FREE_DELIVERY_THRESHOLD = 999;
export const STANDARD_DELIVERY_FEE = 79;

/** Ch.8 §93 Cart Validation, the parts checkable without a database round trip (existence/published/inventory checks happen against real repository data in the caller). */
export function validateCartIsNotEmpty(lines: CartLineInput[]): string[] {
  if (lines.length === 0) return ['Cart is empty.'];
  if (lines.some((line) => line.quantity <= 0))
    return ['Every cart line must have a positive quantity.'];
  return [];
}

/** Ch.8 §89 Principle 1: "Always recalculate... never trust [price] coming from the client." Pricing is computed fresh from server-fetched unit prices, never from anything the request body supplied. */
export function computePricing(params: {
  lines: ValidatedCartLine[];
  couponDiscount?: number;
}): PricingBreakdown {
  const subtotal = params.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const couponDiscount = Math.min(params.couponDiscount ?? 0, subtotal);
  const discountTotal = couponDiscount;
  const afterDiscount = subtotal - discountTotal;
  const deliveryFee = afterDiscount >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE;
  const taxTotal = Math.round(afterDiscount * TAX_RATE * 100) / 100;
  const grandTotal = afterDiscount + deliveryFee + taxTotal;

  return { subtotal, discountTotal, couponDiscount, deliveryFee, taxTotal, grandTotal };
}

export interface CouponRecord {
  code: string;
  discountType: 'percentage' | 'fixed' | 'free_delivery' | 'free_gift';
  discountValue: number;
  maxDiscountAmount: number | null;
  minCartValue: number;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  timesUsed: number;
  usageLimitTotal: number | null;
}

/** Ch.8 §74 Coupon Validation Rules. */
export function validateCoupon(coupon: CouponRecord, cartSubtotal: number, now: Date): string[] {
  const violations: string[] = [];
  if (!coupon.active) violations.push('This coupon is no longer active.');
  if (coupon.startsAt && new Date(coupon.startsAt) > now)
    violations.push('This coupon is not active yet.');
  if (coupon.endsAt && new Date(coupon.endsAt) < now) violations.push('This coupon has expired.');
  if (cartSubtotal < coupon.minCartValue) {
    violations.push(`This coupon requires a minimum cart value of ₹${coupon.minCartValue}.`);
  }
  if (coupon.usageLimitTotal != null && coupon.timesUsed >= coupon.usageLimitTotal) {
    violations.push('This coupon has reached its usage limit.');
  }
  return violations;
}

export function calculateCouponDiscount(coupon: CouponRecord, cartSubtotal: number): number {
  if (coupon.discountType === 'percentage') {
    const raw = cartSubtotal * (coupon.discountValue / 100);
    return coupon.maxDiscountAmount != null ? Math.min(raw, coupon.maxDiscountAmount) : raw;
  }
  if (coupon.discountType === 'fixed') {
    return Math.min(coupon.discountValue, cartSubtotal);
  }
  // free_delivery / free_gift affect delivery fee / fulfillment, not the discount line — 0 here by design.
  return 0;
}

export interface OutletCandidate {
  id: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;
  isActive: boolean;
}

/** Haversine distance in km. */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Ch.8 §96 Outlet Assignment Engine: nearby -> active -> within radius,
 * sorted by distance. Inventory filtering happens in the caller (this
 * function doesn't know about stock), matching §96's own step order
 * ("Remove Outlets Without Inventory" comes after this list is built).
 */
export function rankOutletsByDistance(
  outlets: OutletCandidate[],
  customerLat: number,
  customerLon: number,
): { outlet: OutletCandidate; distanceKm: number }[] {
  return outlets
    .filter((outlet) => outlet.isActive)
    .map((outlet) => ({
      outlet,
      distanceKm: distanceKm(customerLat, customerLon, outlet.latitude, outlet.longitude),
    }))
    .filter((entry) => entry.distanceKm <= entry.outlet.deliveryRadiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
