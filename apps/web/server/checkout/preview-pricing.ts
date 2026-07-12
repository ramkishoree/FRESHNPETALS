import 'server-only';
import {
  BusinessRuleError,
  err,
  InfrastructureError,
  ok,
  type AppError,
  type Result,
} from '@prana/core';
import {
  calculateCouponDiscount,
  computePricing,
  rankOutletsByDistance,
  validateCartIsNotEmpty,
  validateCoupon,
  type CartLineInput,
  type CouponRecord,
  type PricingBreakdown,
  type ValidatedCartLine,
} from '@prana/commerce';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getRateConfig } from '@/server/checkout/get-rate-config';
import { resolveActiveOffer } from '@/server/checkout/resolve-offer';
import { resolveCouponEligibilityContext } from '@/server/checkout/coupon-eligibility';

export interface PreviewPricingInput {
  lines: CartLineInput[];
  couponCode?: string;
  /** Required to validate first_order/birthday-eligibility coupons —
   * omitted only when no couponCode is given either. */
  customerId?: string;
  /** Delivery pin coordinates from Google Maps (where the customer wants delivery). */
  addressLatitude?: number;
  addressLongitude?: number;
  /** When the customer has manually selected an outlet, use it instead of
   *  the nearest auto-detect. */
  selectedOutletId?: string;
}

export interface PreviewPricingResult {
  pricing: PricingBreakdown;
  appliedCouponCode: string | null;
  /** buy_x_get_y/free_gift's bonus item, shown so the customer can see
   * "+1 free X" before paying — informational only here (no outlet is
   * necessarily selected yet during preview), startCheckout re-checks
   * real stock at the actual selected outlet before ever granting it. */
  bonusItem: { productId: string; productName: string; quantity: number } | null;
}

/**
 * Same price/coupon math as startCheckout (Ch.8 §89 Principle 1 — never
 * trust client-supplied prices), minus outlet/inventory assignment and
 * without creating a checkout_sessions row or Razorpay order. Lets the
 * checkout UI show a live "apply coupon" total before the customer commits
 * to payment; startCheckout still recomputes everything from scratch when
 * they actually pay, so this preview is purely informational.
 */
export async function previewCheckoutPricing(
  input: PreviewPricingInput,
): Promise<Result<PreviewPricingResult, AppError>> {
  const cartViolations = validateCartIsNotEmpty(input.lines);
  if (cartViolations.length > 0) {
    return err(new BusinessRuleError(cartViolations.join(' ')));
  }

  const admin = createSupabaseAdminClient();
  const productIds = input.lines.map((line) => line.productId);

  const { data: products, error: productsError } = await admin
    .from('products')
    .select('id, sku, name, status, category_id, product_prices(base_price, sale_price)')
    .in('id', productIds);
  if (productsError) {
    return err(
      new InfrastructureError('Failed to load products.', { cause: productsError.message }),
    );
  }

  const validatedLines: ValidatedCartLine[] = [];
  for (const line of input.lines) {
    const product = products?.find((p) => p.id === line.productId);
    if (!product) {
      return err(
        new BusinessRuleError(`Product ${line.productId} not found.`, { httpStatus: 404 }),
      );
    }
    if (product.status !== 'published') {
      return err(
        new BusinessRuleError(`"${product.name}" is not currently available for purchase.`),
      );
    }
    const priceRow = Array.isArray(product.product_prices)
      ? product.product_prices[0]
      : product.product_prices;
    const unitPrice =
      priceRow?.sale_price != null
        ? Number(priceRow.sale_price)
        : Number(priceRow?.base_price ?? 0);
    validatedLines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      quantity: line.quantity,
      unitPrice,
    });
  }
  const cartCategoryIds = [
    ...new Set((products ?? []).map((p) => p.category_id).filter((id): id is string => !!id)),
  ];

  // Distance-based delivery fee: compute the straight-line distance from the
  // delivery pin (Google Maps) to the selected outlet. If no outlet has been
  // explicitly selected by the customer, fall back to the nearest active outlet.
  let deliveryDistanceKm: number | undefined;
  if (input.addressLatitude != null && input.addressLongitude != null) {
    const { data: outlets, error: outletsError } = await admin
      .from('outlets')
      .select('id, latitude, longitude, delivery_radius_km, is_active')
      .eq('is_active', true);
    if (!outletsError && outlets) {
      const candidates = outlets.map((o) => ({
        id: o.id,
        latitude: Number(o.latitude),
        longitude: Number(o.longitude),
        deliveryRadiusKm: Number(o.delivery_radius_km),
        isActive: o.is_active,
      }));

      // When the customer picked a specific outlet, compute distance to it.
      // Otherwise auto-select the nearest active outlet.
      const outletSubset = input.selectedOutletId
        ? candidates.filter((c) => c.id === input.selectedOutletId)
        : candidates;

      const ranked = rankOutletsByDistance(
        outletSubset,
        input.addressLatitude,
        input.addressLongitude,
      );
      deliveryDistanceKm = ranked.at(0)?.distanceKm;
    }
  }

  let couponDiscount = 0;
  let appliedCouponCode: string | null = null;
  if (input.couponCode) {
    const { data: couponRow } = await admin
      .from('coupons')
      .select(
        'id, code, discount_type, eligibility_type, discount_value, max_discount_amount, min_cart_value, starts_at, ends_at, active, times_used, usage_limit_total',
      )
      .eq('code', input.couponCode.toUpperCase())
      .maybeSingle();

    if (!couponRow) {
      return err(new BusinessRuleError('Invalid coupon code.'));
    }

    const coupon: CouponRecord = {
      code: couponRow.code,
      discountType: couponRow.discount_type,
      discountValue: Number(couponRow.discount_value),
      maxDiscountAmount:
        couponRow.max_discount_amount != null ? Number(couponRow.max_discount_amount) : null,
      minCartValue: Number(couponRow.min_cart_value),
      eligibilityType: couponRow.eligibility_type,
      startsAt: couponRow.starts_at,
      endsAt: couponRow.ends_at,
      active: couponRow.active,
      timesUsed: couponRow.times_used,
      usageLimitTotal: couponRow.usage_limit_total,
    };

    const subtotal = validatedLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    const eligibility = input.customerId
      ? await resolveCouponEligibilityContext(admin, input.customerId)
      : {};
    const couponViolations = validateCoupon(coupon, subtotal, new Date(), eligibility);
    if (couponViolations.length > 0) {
      return err(new BusinessRuleError(couponViolations.join(' ')));
    }

    couponDiscount = calculateCouponDiscount(coupon, subtotal);
    appliedCouponCode = coupon.code;
  }

  const cartSubtotalForOffers = validatedLines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const cartQuantityByProduct: Record<string, number> = {};
  for (const line of validatedLines) {
    cartQuantityByProduct[line.productId] =
      (cartQuantityByProduct[line.productId] ?? 0) + line.quantity;
  }
  const { offerDiscount, freeDeliveryFromOffer, bonusItem } = await resolveActiveOffer(
    admin,
    cartSubtotalForOffers,
    validatedLines.map((line) => line.productId),
    cartCategoryIds,
    cartQuantityByProduct,
  );

  let bonusItemDisplay: PreviewPricingResult['bonusItem'] = null;
  if (bonusItem) {
    const { data: bonusProduct } = await admin
      .from('products')
      .select('name')
      .eq('id', bonusItem.productId)
      .maybeSingle();
    if (bonusProduct) {
      bonusItemDisplay = {
        productId: bonusItem.productId,
        productName: bonusProduct.name,
        quantity: bonusItem.quantity,
      };
    }
  }

  const pricing = computePricing({
    lines: validatedLines,
    couponDiscount,
    offerDiscount,
    freeDeliveryFromOffer,
    deliveryDistanceKm: deliveryDistanceKm ?? null,
    rates: await getRateConfig(admin),
  });
  return ok({ pricing, appliedCouponCode, bonusItem: bonusItemDisplay });
}
