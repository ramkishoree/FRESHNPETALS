import 'server-only';
import {
  BusinessRuleError,
  err,
  ExternalServiceError,
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
  type CheckoutAddressInput,
  type CouponRecord,
  type ValidatedCartLine,
} from '@prana/commerce';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getRateConfig } from '@/server/checkout/get-rate-config';
import { resolveActiveOffer } from '@/server/checkout/resolve-offer';
import { resolveCouponEligibilityContext } from '@/server/checkout/coupon-eligibility';
import { createRazorpayOrder, isRazorpayConfigured } from '@/server/payments/razorpay-adapter';

export interface StartCheckoutInput {
  customerId: string;
  lines: CartLineInput[];
  address: CheckoutAddressInput;
  couponCode?: string;
  deliverySlotId?: string;
  /** When the customer has manually selected an outlet, skip auto-ranking
   *  and use this one (after verifying it has sufficient inventory). */
  selectedOutletId?: string;
}

export interface StartCheckoutResult {
  checkoutSessionId: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amount: number;
  currency: string;
}

/**
 * Ch.8 §92 Checkout Pipeline, the parts before "Redirect to Payment."
 * Ch.8 §89 Principle 1: every price/inventory/coupon value is re-fetched
 * from the database here — nothing from the request body is trusted
 * except product ids, quantities, and the coupon code string itself.
 */
export async function startCheckout(
  input: StartCheckoutInput,
): Promise<Result<StartCheckoutResult, AppError>> {
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
  }

  // Owner's explicit call: price and sale price are the same at every
  // outlet — resolved straight from the product's global price row, same
  // as before per-outlet overrides ever existed.
  const validatedLines: ValidatedCartLine[] = input.lines.map((line) => {
    const product = products!.find((p) => p.id === line.productId)!;
    const priceRow = Array.isArray(product.product_prices)
      ? product.product_prices[0]
      : product.product_prices;
    const basePrice = Number(priceRow?.base_price ?? 0);
    const salePrice = priceRow?.sale_price != null ? Number(priceRow.sale_price) : null;
    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      quantity: line.quantity,
      unitPrice: salePrice ?? basePrice,
    };
  });

  const cartCategoryIds = [
    ...new Set((products ?? []).map((p) => p.category_id).filter((id): id is string => !!id)),
  ];

  // Ch.8 §96 Outlet Assignment Engine.
  const { data: outlets, error: outletsError } = await admin
    .from('outlets')
    .select('id, latitude, longitude, delivery_radius_km, is_active')
    .eq('is_active', true)
    .is('deleted_at', null);
  if (outletsError) {
    return err(new InfrastructureError('Failed to load outlets.', { cause: outletsError.message }));
  }

  let selectedOutletId: string | null = null;
  let deliveryDistanceKm: number | undefined;

  if (input.selectedOutletId) {
    // Customer explicitly chose an outlet — verify it exists, is active,
    // and has enough stock for every item.
    const chosen = (outlets ?? []).find((o) => o.id === input.selectedOutletId);
    if (!chosen) {
      return err(
        new BusinessRuleError('The selected outlet is no longer available.', { httpStatus: 409 }),
      );
    }

    const { data: invRows } = await admin
      .from('inventory')
      .select('product_id, available_quantity')
      .eq('outlet_id', chosen.id)
      .in('product_id', productIds);

    const hasAllStock = input.lines.every((line) => {
      const row = invRows?.find((i) => i.product_id === line.productId);
      return row && row.available_quantity >= line.quantity;
    });

    if (!hasAllStock) {
      return err(
        new BusinessRuleError(
          'The selected outlet does not have enough stock. Please try another.',
          { httpStatus: 409 },
        ),
      );
    }

    selectedOutletId = chosen.id;
    if (input.address.latitude != null && input.address.longitude != null) {
      const ranked = rankOutletsByDistance(
        [
          {
            id: chosen.id,
            latitude: Number(chosen.latitude),
            longitude: Number(chosen.longitude),
            deliveryRadiusKm: Number(chosen.delivery_radius_km),
            isActive: chosen.is_active,
          },
        ],
        input.address.latitude,
        input.address.longitude,
      );
      deliveryDistanceKm = ranked.at(0)?.distanceKm;
    }
  } else {
    // Auto-rank: try outlets nearest-first until one has full inventory.
    const ranked =
      input.address.latitude != null && input.address.longitude != null
        ? rankOutletsByDistance(
            (outlets ?? []).map((o) => ({
              id: o.id,
              latitude: Number(o.latitude),
              longitude: Number(o.longitude),
              deliveryRadiusKm: Number(o.delivery_radius_km),
              isActive: o.is_active,
            })),
            input.address.latitude,
            input.address.longitude,
          )
        : (outlets ?? []).map((o) => ({
            outlet: { id: o.id, latitude: 0, longitude: 0, deliveryRadiusKm: 0, isActive: true },
            distanceKm: 0,
          }));

    for (const candidate of ranked) {
      const { data: inventoryRows } = await admin
        .from('inventory')
        .select('product_id, available_quantity')
        .eq('outlet_id', candidate.outlet.id)
        .in('product_id', productIds);

      const hasAllStock = input.lines.every((line) => {
        const row = inventoryRows?.find((i) => i.product_id === line.productId);
        return row && row.available_quantity >= line.quantity;
      });
      if (hasAllStock) {
        selectedOutletId = candidate.outlet.id;
        deliveryDistanceKm = candidate.distanceKm;
        break;
      }
    }
  }

  if (!selectedOutletId) {
    // Ch.8 §97 Multi-Outlet Fallback — "Never create impossible orders."
    return err(
      new BusinessRuleError(
        'No outlet can currently fulfill this order. Try adjusting quantities or your delivery address.',
        {
          httpStatus: 409,
        },
      ),
    );
  }

  // Ch.8 §74 Coupon Validation.
  let couponDiscount = 0;
  let couponSnapshot: Record<string, unknown> = {};
  if (input.couponCode) {
    const { data: couponRow } = await admin
      .from('coupons')
      .select(
        'id, code, discount_type, eligibility_type, discount_value, max_discount_amount, min_cart_value, starts_at, ends_at, active, times_used, usage_limit_total',
      )
      .eq('code', input.couponCode.toUpperCase())
      .is('deleted_at', null)
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
    const eligibility = await resolveCouponEligibilityContext(admin, input.customerId);
    const couponViolations = validateCoupon(coupon, subtotal, new Date(), eligibility);
    if (couponViolations.length > 0) {
      return err(new BusinessRuleError(couponViolations.join(' ')));
    }

    couponDiscount = calculateCouponDiscount(coupon, subtotal);
    couponSnapshot = {
      id: couponRow.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    };
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

  // Ch.8 §69-72 buy_x_get_y / free_gift — a genuinely free extra line item,
  // reserved from the same already-selected outlet's real stock exactly
  // like every paid line above. If that outlet doesn't have it, the
  // bonus is silently skipped rather than failing a paying customer's
  // checkout over a free extra (Ch.8 §97 "never create impossible
  // orders" applies just as much to a bonus item as a paid one).
  if (bonusItem) {
    const { data: bonusProduct } = await admin
      .from('products')
      .select('id, sku, name, status')
      .eq('id', bonusItem.productId)
      .eq('status', 'published')
      .maybeSingle();

    if (bonusProduct) {
      const { data: bonusInventory } = await admin
        .from('inventory')
        .select('available_quantity')
        .eq('product_id', bonusItem.productId)
        .eq('outlet_id', selectedOutletId)
        .maybeSingle();

      if ((bonusInventory?.available_quantity ?? 0) >= bonusItem.quantity) {
        // Always its own line at unitPrice 0, even if the same product is
        // already a paid line — merging quantities in would charge the
        // full price for what's supposed to be free. checkout_start's
        // reservation loop and checkout_complete's order_items insert
        // both key off the line array, not product-id uniqueness, so two
        // lines for the same product reserve/record correctly as two
        // sequential steps rather than colliding.
        validatedLines.push({
          productId: bonusProduct.id,
          sku: bonusProduct.sku,
          name: `${bonusProduct.name} (free gift)`,
          quantity: bonusItem.quantity,
          unitPrice: 0,
        });
      }
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

  const { data: sessionRow, error: sessionError } = await admin.rpc('checkout_start', {
    p_customer_id: input.customerId,
    p_items: validatedLines.map((line) => ({
      product_id: line.productId,
      sku: line.sku,
      name: line.name,
      quantity: line.quantity,
      unit_price: line.unitPrice,
    })),
    p_outlet_id: selectedOutletId,
    p_address_snapshot: input.address,
    p_pricing_snapshot: {
      subtotal: pricing.subtotal,
      discountTotal: pricing.discountTotal,
      couponDiscount: pricing.couponDiscount,
      offerDiscount: pricing.offerDiscount,
      deliveryFee: pricing.deliveryFee,
      deliveryDistanceKm: pricing.deliveryDistanceKm,
      taxTotal: pricing.taxTotal,
      grandTotal: pricing.grandTotal,
    },
    p_cart_snapshot: {
      items: validatedLines.map((line) => ({
        product_id: line.productId,
        sku: line.sku,
        name: line.name,
        quantity: line.quantity,
        unit_price: line.unitPrice,
      })),
    },
    p_selected_delivery_slot: input.deliverySlotId ?? null,
    p_coupon_snapshot: couponSnapshot,
  });

  if (sessionError) {
    const message = sessionError.message ?? '';
    if (message.includes('Insufficient inventory')) {
      return err(
        new BusinessRuleError('One or more items just sold out. Please review your cart.', {
          httpStatus: 409,
        }),
      );
    }
    if (message.includes('is fully booked')) {
      return err(
        new BusinessRuleError('That delivery slot just filled up. Please pick another.', {
          httpStatus: 409,
        }),
      );
    }
    if (message.includes('is not available')) {
      return err(
        new BusinessRuleError('That delivery slot is no longer available. Please pick another.', {
          httpStatus: 409,
        }),
      );
    }
    return err(new InfrastructureError('Failed to start checkout.', { cause: message }));
  }

  const session = sessionRow as { id: string };

  if (!isRazorpayConfigured()) {
    return err(new ExternalServiceError('Payments are not configured yet.'));
  }

  try {
    const razorpayOrder = await createRazorpayOrder({
      amountInRupees: pricing.grandTotal,
      receipt: session.id,
    });

    // The webhook only receives Razorpay's own order id (never our
    // internal session id), so it needs a way back to this session —
    // recorded here, at the one point both ids are known together.
    await admin
      .from('checkout_sessions')
      .update({ status: 'payment_pending', metadata: { razorpayOrderId: razorpayOrder.id } })
      .eq('id', session.id);

    return ok({
      checkoutSessionId: session.id,
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId: process.env['RAZORPAY_KEY_ID'] ?? '',
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    });
  } catch (cause) {
    await admin.rpc('checkout_cancel', {
      p_checkout_session_id: session.id,
      p_new_status: 'cancelled',
    });
    return err(
      new ExternalServiceError('Failed to create payment order.', {
        cause: cause instanceof Error ? cause.message : String(cause),
      }),
    );
  }
}
