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
  validateCartIsNotEmpty,
  validateCoupon,
  type CartLineInput,
  type CouponRecord,
  type PricingBreakdown,
  type ValidatedCartLine,
} from '@prana/commerce';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export interface PreviewPricingInput {
  lines: CartLineInput[];
  couponCode?: string;
}

export interface PreviewPricingResult {
  pricing: PricingBreakdown;
  appliedCouponCode: string | null;
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
    .select('id, sku, name, status, product_prices(base_price, sale_price)')
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

  let couponDiscount = 0;
  let appliedCouponCode: string | null = null;
  if (input.couponCode) {
    const { data: couponRow } = await admin
      .from('coupons')
      .select(
        'id, code, discount_type, discount_value, max_discount_amount, min_cart_value, starts_at, ends_at, active, times_used, usage_limit_total',
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
      startsAt: couponRow.starts_at,
      endsAt: couponRow.ends_at,
      active: couponRow.active,
      timesUsed: couponRow.times_used,
      usageLimitTotal: couponRow.usage_limit_total,
    };

    const subtotal = validatedLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    const couponViolations = validateCoupon(coupon, subtotal, new Date());
    if (couponViolations.length > 0) {
      return err(new BusinessRuleError(couponViolations.join(' ')));
    }

    couponDiscount = calculateCouponDiscount(coupon, subtotal);
    appliedCouponCode = coupon.code;
  }

  const pricing = computePricing({ lines: validatedLines, couponDiscount });
  return ok({ pricing, appliedCouponCode });
}
