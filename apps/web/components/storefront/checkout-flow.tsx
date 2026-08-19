'use client';

import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { ContactUsButton } from '@/components/commerce/contact-us-button';
import { PriceDisplay } from '@/components/commerce/price-display';
import { DeliveryMap, type MapLocation } from '@/components/storefront/delivery-map';
import { rankOutletsByDistance } from '@prana/commerce';
import { OutletSelector, type OutletWithStock } from '@/components/storefront/outlet-selector';
import { BrandDivider } from '@/components/storefront/brand-divider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clearBuyNowItem, readBuyNowItem, setBuyNowItem as persistBuyNowItem } from '@/lib/buy-now';
import { type CartLineItem, useCart } from '@/lib/cart-context';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: () => void) => void;
    };
  }
}

/** Today's date in IST (YYYY-MM-DD) — matches the server's own IST-based
 *  cutoff so the picker can't offer a date the API will reject anyway. */
function getTodayIST(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
  return fmt.format(new Date());
}

const EMPTY_ADDRESS = {
  recipientName: '',
  phone: '',
  email: '',
  flatNo: '',
};

interface DeliverySlotOption {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  bookable: boolean;
}

interface DeliverySlotsResponse {
  date: string;
  slots: DeliverySlotOption[];
  hasBookableSlot: boolean;
  nextAvailableDate: string | null;
}

interface PricingBreakdown {
  subtotal: number;
  discountTotal: number;
  couponDiscount: number;
  offerDiscount: number;
  deliveryFee: number;
  deliveryDistanceKm: number | null;
  nightCharge: number;
  taxTotal: number;
  grandTotal: number;
}

/**
 * Ch.12 §26 Checkout Experience — "Single-page checkout." The customer:
 *   1. Drops a pin on Google Maps (or searches via Places autocomplete).
 *   2. Sees every outlet ranked by distance, with stock for each cart item.
 *   3. Picks which outlet fulfills the order.
 *   4. Enters address details (recipient, phone, etc.).
 *   5. Applies a coupon if they have one.
 *   6. Pays.
 *
 * Delivery fee is computed from the selected outlet to the delivery pin —
 * not from the customer's current GPS position — so the fee is always
 * tied to where the package is going and which outlet they choose.
 */
export function CheckoutFlow({
  nonce,
  ownerPhoneNumber,
}: {
  nonce?: string;
  ownerPhoneNumber?: string;
}) {
  const cart = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();

  /**
   * Checkout sells either the basket or a single "buy now" item, never
   * both. Read once on mount: the basket must stay untouched through a
   * buy-now order, so the two sources have to stay genuinely separate
   * rather than the instant purchase being shoved into the basket and
   * pulled back out again.
   */
  const [buyNowItem, setBuyNowItem] = React.useState<CartLineItem | null>(null);
  const [hasReadBuyNow, setHasReadBuyNow] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBuyNowItem(readBuyNowItem());
    setHasReadBuyNow(true);
  }, []);

  const isBuyNow = buyNowItem !== null;
  const items = React.useMemo(
    () => (buyNowItem ? [buyNowItem] : cart.items),
    [buyNowItem, cart.items],
  );
  const subtotal = buyNowItem
    ? (buyNowItem.salePrice ?? buyNowItem.unitPrice) * buyNowItem.quantity
    : cart.subtotal;

  const setQuantity = React.useCallback(
    (productId: string, quantity: number) => {
      if (buyNowItem) {
        const next = { ...buyNowItem, quantity: Math.max(1, quantity) };
        setBuyNowItem(next);
        persistBuyNowItem(next);
        return;
      }
      cart.setQuantity(productId, quantity);
    },
    [buyNowItem, cart],
  );

  const removeItem = React.useCallback(
    (productId: string) => {
      if (buyNowItem) {
        // The only line there is — dropping it means there is nothing
        // left to check out, so send them somewhere they can shop.
        setBuyNowItem(null);
        clearBuyNowItem();
        router.replace('/cart');
        return;
      }
      cart.removeItem(productId);
    },
    [buyNowItem, cart, router],
  );

  /** Discards exactly what was just sold, and nothing else. */
  const clearPurchased = React.useCallback(() => {
    if (isBuyNow) {
      clearBuyNowItem();
      setBuyNowItem(null);
      return;
    }
    cart.clear();
  }, [isBuyNow, cart]);

  const [manualAddress, setManualAddress] = React.useState(EMPTY_ADDRESS);
  const [couponInput, setCouponInput] = React.useState('');
  const [appliedCoupon, setAppliedCoupon] = React.useState<string | null>(null);
  const [pricing, setPricing] = React.useState<PricingBreakdown | null>(null);
  const [bonusItem, setBonusItem] = React.useState<{
    productName: string;
    quantity: number;
  } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = React.useState(false);
  const [couponMessage, setCouponMessage] = React.useState<string | null>(null);
  const [isPaying, setIsPaying] = React.useState(false);
  const [scriptReady, setScriptReady] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<'razorpay' | 'cod'>('razorpay');

  // ---- Delivery slot state ---------------------------------------------------
  const [slotDate, setSlotDate] = React.useState<string | null>(null);
  const [slotsResponse, setSlotsResponse] = React.useState<DeliverySlotsResponse | null>(null);
  const [selectedSlotId, setSelectedSlotId] = React.useState<string | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = React.useState(true);

  // ---- Delivery pin and outlet selection -------------------------------------
  const [outlets, setOutlets] = React.useState<OutletWithStock[]>([]);
  const [deliveryPin, setDeliveryPin] = React.useState<MapLocation | null>(null);
  // The customer's explicit pick always wins; it resets back to "follow the
  // nearest outlet" whenever the delivery pin moves (below), matching the
  // React-recommended "adjust state during render" pattern rather than an
  // effect — avoids a render -> effect -> setState -> render cascade for
  // what is, in the end, a value fully derived from deliveryPin/outlets.
  const [manualOutletId, setManualOutletId] = React.useState<string | null>(null);
  const [pinKeyAtLastReset, setPinKeyAtLastReset] = React.useState<string | null>(null);
  const pinKey = deliveryPin ? `${deliveryPin.lat},${deliveryPin.lng}` : null;
  if (pinKey !== pinKeyAtLastReset) {
    setPinKeyAtLastReset(pinKey);
    setManualOutletId(null);
  }

  // ---- Helpers ----------------------------------------------------------------

  /** Coordinates from the delivery pin (Google Maps). Null until the
   *  customer places one — the server then answers with its flat
   *  fallback rate, which the summary deliberately does not show as a
   *  quote (see `hasDeliveryQuote`). */
  function resolveDeliveryCoords(): { lat: number; lng: number } | null {
    return deliveryPin ? { lat: deliveryPin.lat, lng: deliveryPin.lng } : null;
  }

  /** Fetch pricing from the server using the delivery pin coords and the
   *  selected outlet (if any). Never trusts client-side prices. */
  async function loadPricing(couponCode: string | null): Promise<PricingBreakdown | null> {
    if (items.length === 0) return null;
    const coords = resolveDeliveryCoords();
    try {
      const response = await fetch('/api/v1/checkout/coupon-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          ...(couponCode ? { couponCode } : {}),
          ...(coords ? { addressLatitude: coords.lat, addressLongitude: coords.lng } : {}),
          ...(selectedOutletId ? { selectedOutletId } : {}),
          // Without this the summary shows a total that jumps at the
          // final step when a late slot adds the night charge.
          ...(selectedSlotId ? { deliverySlotId: selectedSlotId } : {}),
        }),
      });
      const body = await response.json();
      if (response.ok && body.success) {
        setPricing(body.data.pricing);
        setBonusItem(body.data.bonusItem ?? null);
        return body.data.pricing;
      }
    } catch {
      // Pricing preview is non-critical — silently fall back to client-side subtotal.
    }
    setPricing(null);
    setBonusItem(null);
    return null;
  }

  // ---- Effects ----------------------------------------------------------------

  // Fetch outlets with stock for the cart items on mount.
  React.useEffect(() => {
    if (items.length === 0) return;
    const productIds = items.map((i) => i.productId).join(',');
    (async () => {
      try {
        const res = await fetch(
          `/api/v1/outlets/with-stock?productIds=${encodeURIComponent(productIds)}`,
        );
        const body = await res.json();
        if (res.ok && body.success) {
          setOutlets(body.data);
        }
      } catch {
        // Non-critical — the user will see an error if they try to pay.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // Nearest outlet by Haversine distance — pure derivation from
  // deliveryPin/outlets, recomputed on render rather than synced via effect.
  /**
   * Outlets that can actually reach this pin, nearest first.
   *
   * The selector already filtered by each outlet's delivery radius while
   * the page picked a default by raw distance, so the two disagreed: a
   * pin in Delhi showed "no outlets" and silently selected Gomti Nagar
   * anyway, quoting a fee and enabling Pay for an order nobody could
   * deliver. One shared answer, from the same function the selector
   * uses, is what stops that happening again.
   */
  const serviceableOutlets = React.useMemo(() => {
    if (!deliveryPin || outlets.length === 0) return [];
    return rankOutletsByDistance(
      outlets.map((outlet) => ({
        id: outlet.id,
        latitude: outlet.latitude,
        longitude: outlet.longitude,
        deliveryRadiusKm: outlet.deliveryRadiusKm,
        isActive: true,
      })),
      deliveryPin.lat,
      deliveryPin.lng,
    );
  }, [deliveryPin, outlets]);

  const nearestOutletId = serviceableOutlets[0]?.outlet.id ?? null;

  /** A pinned address no branch delivers to. Only the owner can help. */
  const isOutsideDeliveryArea =
    deliveryPin != null && outlets.length > 0 && serviceableOutlets.length === 0;

  // A manual pick is honoured only while it can still serve the pin —
  // moving the pin out of range must not leave the old choice standing.
  const selectedOutletId =
    manualOutletId && serviceableOutlets.some((entry) => entry.outlet.id === manualOutletId)
      ? manualOutletId
      : nearestOutletId;
  // The outlet actually fulfilling the order — its stock is the ceiling
  // on how many of each item the customer can order.
  const selectedOutlet = outlets.find((outlet) => outlet.id === selectedOutletId) ?? null;

  /**
   * Why the order can't be placed yet, or null when it can.
   *
   * The delivery fee is computed from the pin to the chosen outlet, so
   * without a pin there is no fee and no honest total to charge. These
   * were previously checked only inside `payNow`, which meant the
   * customer filled in everything, pressed Pay, and got a toast telling
   * them to go back up the page. Saying it up front — with the button
   * disabled — is the difference between a rule and an ambush.
   */
  /**
   * The fee is measured outlet -> pin, so before both exist there is no
   * fee to state. The server answers with its flat fallback rate in that
   * case, which read as a real quote — the summary showed ₹50 delivery
   * on a checkout that had no idea where it was delivering to. Better to
   * say nothing than to name a number that is going to change.
   */
  const hasDeliveryQuote = pricing != null && deliveryPin != null && selectedOutletId != null;

  const blockingReason = React.useMemo(() => {
    if (items.length === 0) return 'Your basket is empty.';
    const missing = findMissingAddressFields(manualAddress);
    if (missing.length > 0) return `Fill in your ${missing.join(', ')} to continue.`;
    if (!deliveryPin) {
      return 'Search for your address or drag the pin on the map — the delivery fee is worked out from it.';
    }
    if (isOutsideDeliveryArea)
      return 'None of our branches deliver to this address. Call us — we can sometimes arrange it by hand.';
    if (!selectedOutletId) return 'Choose which outlet should fulfil this order.';
    if (slotsResponse?.hasBookableSlot && !selectedSlotId) return 'Choose a delivery time.';
    return null;
  }, [
    items.length,
    manualAddress,
    deliveryPin,
    isOutsideDeliveryArea,
    selectedOutletId,
    slotsResponse,
    selectedSlotId,
  ]);

  // Switching outlets can leave a quantity the new shop cannot fill.
  // Clamping here means the customer sees the corrected number before
  // they pay, rather than a rejection from the server after.
  React.useEffect(() => {
    if (!selectedOutlet) return;
    for (const item of items) {
      const stock = selectedOutlet.stock[item.productId];
      if (stock !== undefined && stock > 0 && item.quantity > stock) {
        // The cascade is the point and it terminates: the clamped
        // quantity is <= stock, so the next pass finds nothing to fix.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setQuantity(item.productId, stock);
      }
    }
  }, [selectedOutlet, items, setQuantity]);

  // Fetch delivery slots for the selected date (defaults to today on the
  // server). Auto-advances to the server's suggested next-available date
  // the first time today comes back with nothing bookable, so the
  // customer doesn't land on a picker with every slot already crossed
  // out — but only once (only when slotDate is still null), so a manual
  // pick of today by the customer later never gets silently overridden.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingSlots(true);
      try {
        const url = slotDate
          ? `/api/v1/delivery-slots?date=${encodeURIComponent(slotDate)}`
          : '/api/v1/delivery-slots';
        const res = await fetch(url);
        const body = await res.json();
        if (cancelled) return;
        if (res.ok && body.success) {
          const data = body.data as DeliverySlotsResponse;
          setSlotsResponse(data);
          setSelectedSlotId(null);
          if (slotDate === null && !data.hasBookableSlot && data.nextAvailableDate) {
            setSlotDate(data.nextAvailableDate);
            return;
          }
        } else if (slotDate !== null) {
          toast.error(body.error?.message ?? 'That date is not available — pick another.');
          setSlotDate(null);
        }
      } catch {
        // Non-critical — checkout can proceed without a slot.
      } finally {
        if (!cancelled) setIsLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slotDate]);

  // Every input the server prices on, as one string. `items.length` was
  // standing in for the basket, so changing a quantity left the summary
  // showing the total for the old one — four wreaths quoted at the price
  // of one, right up until the real amount appeared in the payment
  // window. Quantity, slot (night charge) and coupon all move the total
  // and all belong here.
  const pricingKey = [
    items.map((item) => `${item.productId}:${item.quantity}`).join(','),
    selectedOutletId ?? '',
    pinKey ?? '',
    selectedSlotId ?? '',
    appliedCoupon ?? '',
  ].join('|');

  React.useEffect(() => {
    if (items.length === 0) return;
    void (async () => {
      // Passing the applied coupon, not null: re-pricing after any other
      // change used to silently drop a coupon the customer had already
      // applied, so the summary showed the undiscounted total.
      await loadPricing(appliedCoupon);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingKey]);

  /**
   * Declared above the empty-cart guard below, not beside the rest of the
   * payment code. React counts hooks per render: the cart hydrates from
   * localStorage, so the first render is empty and returns early, and the
   * next one has items and would have run two extra hooks — "rendered
   * more hooks than during the previous render" (React #310), which took
   * checkout down for anyone who actually had something in their basket.
   */
  interface RazorpayHandoff {
    checkoutSessionId: string;
    /** Present only for a guest checkout — see start-checkout.ts. */
    guestToken?: string;
    razorpayOrderId: string;
    razorpayKeyId: string;
    amount: number;
    currency: string;
  }

  const openRazorpay = React.useCallback(
    (handoff: RazorpayHandoff) => {
      const { checkoutSessionId, razorpayOrderId, razorpayKeyId, amount, currency } = handoff;
      // A guest has no account to look the order up from afterwards, so
      // the token rides along to the polling page and on to their
      // confirmation.
      const guestSuffix = handoff.guestToken ? `?t=${encodeURIComponent(handoff.guestToken)}` : '';

      const razorpay = new window.Razorpay({
        key: razorpayKeyId,
        order_id: razorpayOrderId,
        amount,
        currency,
        name: 'Fresh N Petals',
        // Razorpay hands back the payment id and an HMAC of it. Passing
        // those to the server is what lets it ask Razorpay directly
        // whether the money was captured, instead of the order existing
        // only if a webhook happens to be delivered. Nothing here is
        // trusted on its own — see the confirm-payment route.
        handler: (response: {
          razorpay_payment_id?: string;
          razorpay_order_id?: string;
          razorpay_signature?: string;
        }) => {
          clearPurchased();
          const confirmable =
            response?.razorpay_payment_id && response?.razorpay_order_id ? response : null;
          if (confirmable) {
            // Fire-and-forget on purpose: the processing page polls for
            // the same answer, so a failed or slow confirm costs the
            // customer nothing but a few more seconds of waiting.
            void fetch(`/api/v1/checkout/${checkoutSessionId}/confirm-payment${guestSuffix}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayOrderId: confirmable.razorpay_order_id,
                razorpayPaymentId: confirmable.razorpay_payment_id,
                razorpaySignature: confirmable.razorpay_signature ?? '',
              }),
              keepalive: true,
            }).catch(() => {});
          }
          // `replace`, not `push`: pressing back from the waiting screen
          // should never return to a checkout whose basket has just been
          // emptied — there is nothing left there to do.
          router.replace(`/checkout/${checkoutSessionId}/processing${guestSuffix}`);
        },
        modal: {
          // Closing the payment window is a decision, not an event to
          // wait on. Staying put keeps the pin, outlet, slot and basket
          // exactly as they were, so trying again costs nothing.
          //
          // Razorpay can close its own widget after a charge the bank
          // actually took, so this is not treated as proof of failure:
          // the session stays open, the webhook and confirm-payment can
          // still complete it, and the order then appears under My
          // Orders. The one thing it must not do is strand the customer
          // on a spinner with no terminal state coming.
          ondismiss: () => {
            setIsPaying(false);
            toast.message('Payment cancelled. Your order is still here when you want it.');
          },
        },
      });

      // A failed attempt leaves the session untouched on purpose — the
      // webhook keeps it open so a retry on the same Razorpay order can
      // still succeed. That is right for the data and wrong for the
      // customer: the polling page has no terminal status to wait for,
      // so it span on "Arranging your order" until it timed out into a
      // dead end. Flagging the attempt lets that page stop pretending
      // it is still working. It stays a hint, never a verdict — the
      // page keeps polling, because Razorpay can report a failure the
      // bank actually captured.
      razorpay.on('payment.failed', () => {
        setIsPaying(false);
        toast.error('That payment did not go through. You have not been charged — try again.');
      });

      razorpay.open();
    },
    [clearPurchased, router],
  );

  // Retrying a failed payment reopens the *same* Razorpay order rather
  // than building a fresh checkout, so the stock already reserved for
  // this customer is reused instead of reserved twice — see the payment
  // params route for why that matters on a low-stock item.
  const retrySessionId = searchParams.get('retry');
  const retryStartedRef = React.useRef(false);
  React.useEffect(() => {
    if (!retrySessionId || retryStartedRef.current) return;
    if (!scriptReady || typeof window.Razorpay === 'undefined') return;
    retryStartedRef.current = true;

    (async () => {
      setIsPaying(true);
      try {
        const response = await fetch(`/api/v1/checkout/${retrySessionId}/payment`);
        const body = await response.json();
        if (!response.ok || !body.success) {
          throw new Error(body.error?.message ?? 'That checkout can no longer be paid.');
        }
        openRazorpay(body.data);
      } catch (cause) {
        setIsPaying(false);
        toast.error(cause instanceof Error ? cause.message : 'Could not reopen that payment.');
        // Drop the stale ?retry= so a refresh starts a clean checkout
        // instead of retrying a session that is already gone.
        router.replace('/checkout');
      }
    })();
  }, [retrySessionId, scriptReady, openRazorpay, router]);

  // ---- Guard (empty cart) ----------------------------------------------------

  // `hasReadBuyNow` gates this so the empty-basket message can't flash
  // over a buy-now purchase that simply hasn't been read out of session
  // storage yet.
  if (hasReadBuyNow && items.length === 0) {
    return (
      <div className="container-brand py-14 text-center">
        <p className="text-body-lg">Add something to your cart before checking out.</p>
      </div>
    );
  }

  // ---- Address validation ------------------------------------------------------
  // Owner's explicit call: the map pin is mandatory and is the delivery
  // location itself — flatNo is the only optional extra detail on top of
  // name/phone/email, no separately-typed street/city/postal fields.

  function findMissingAddressFields(address: typeof EMPTY_ADDRESS): string[] {
    const rules: Partial<Record<keyof typeof EMPTY_ADDRESS, { label: string; min?: number }>> = {
      recipientName: { label: 'name' },
      phone: { label: 'phone number', min: 6 },
      email: { label: 'email' },
    };
    return (Object.keys(rules) as (keyof typeof EMPTY_ADDRESS)[])
      .filter((key) => {
        const val = address[key].trim();
        const rule = rules[key]!;
        return val.length === 0 || (rule.min !== undefined && val.length < rule.min);
      })
      .map((key) => rules[key]!.label);
  }

  // ---- Coupon ----------------------------------------------------------------

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setAppliedCoupon(null);
      setCouponMessage(null);
      await loadPricing(null);
      return;
    }
    setIsApplyingCoupon(true);
    setCouponMessage(null);
    try {
      const result = await loadPricing(code);
      if (result) {
        setAppliedCoupon(code);
        setCouponMessage(`"${code}" applied — discount reflected above.`);
      } else {
        setAppliedCoupon(null);
        setCouponMessage('Coupon could not be applied. Check the code or try another.');
      }
    } catch {
      setAppliedCoupon(null);
      setCouponMessage('Could not apply that coupon. Please try again.');
    } finally {
      setIsApplyingCoupon(false);
    }
  }

  function removeCoupon() {
    setCouponInput('');
    setAppliedCoupon(null);
    setCouponMessage(null);
    void loadPricing(null);
  }

  // ---- Payment ---------------------------------------------------------------

  async function payNow() {
    const missing = findMissingAddressFields(manualAddress);
    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.join(', ')}.`);
      return;
    }

    if (!deliveryPin) {
      toast.error('Please pin your delivery location on the map.');
      return;
    }

    if (!selectedOutletId) {
      toast.error('Please select a delivery outlet on the map.');
      return;
    }

    if (slotsResponse?.hasBookableSlot && !selectedSlotId) {
      toast.error('Please choose a delivery time slot.');
      return;
    }

    setIsPaying(true);
    try {
      const response = await fetch('/api/v1/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          selectedOutletId,
          address: {
            recipientName: manualAddress.recipientName,
            phone: manualAddress.phone,
            email: manualAddress.email,
            ...(manualAddress.flatNo ? { flatNo: manualAddress.flatNo } : {}),
            formattedAddress: deliveryPin.formattedAddress,
            latitude: deliveryPin.lat,
            longitude: deliveryPin.lng,
          },
          ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
          ...(selectedSlotId ? { deliverySlotId: selectedSlotId } : {}),
          ...(slotsResponse?.date ? { deliveryDate: slotsResponse.date } : {}),
          paymentMethod,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to start checkout.');

      if (body.data.paymentMethod === 'cod') {
        clearPurchased();
        // Straight to the order. Cash on delivery completes inside this
        // one request — the order id is in the response — so there is
        // nothing to wait for. Routing it through the payment-waiting
        // screen meant a customer who had already placed an order sat
        // watching a spinner poll for a status that was set before the
        // page even loaded.
        router.replace(
          body.data.guestToken
            ? `/order/${body.data.checkoutSessionId}?t=${encodeURIComponent(body.data.guestToken)}`
            : `/account/orders/${body.data.orderId}`,
        );
        return;
      }

      if (!scriptReady || typeof window.Razorpay === 'undefined') {
        throw new Error('Payment provider is still loading. Please try again in a moment.');
      }

      openRazorpay(body.data);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to start checkout.');
      setIsPaying(false);
    }
  }

  // ---- Render ----------------------------------------------------------------

  return (
    <div className="container-brand py-14">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        {...(nonce ? { nonce } : {})}
        onReady={() => setScriptReady(true)}
        onLoad={() => setScriptReady(true)}
      />

      <header className="mb-10 text-center">
        <p className="eyebrow mb-2">Choose your delivery</p>
        <h1 className="text-h1">Checkout</h1>
        <BrandDivider className="mt-6" />
      </header>

      <div className="grid min-w-0 gap-10 lg:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0 space-y-8">
          {/* ---- Pin your delivery location (Google Maps) ---- */}
          <section className="rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6">
            <h2 className="text-h4 mb-4">Pin your delivery location</h2>
            <DeliveryMap onLocationChange={setDeliveryPin} />
          </section>

          {/* ---- Outside every delivery radius ---- */}
          {isOutsideDeliveryArea && (
            <section className="rounded-[var(--r-lg)] border border-[var(--sale)]/40 bg-[var(--sf-surface)] p-6">
              <h2 className="text-h4 mb-2">We don&rsquo;t deliver here yet</h2>
              <p className="text-body">
                {deliveryPin?.locality ?? 'That address'} is outside the range of every branch, so
                this order can&rsquo;t be placed online. Long-distance deliveries are sometimes
                possible by arrangement — give us a call and we&rsquo;ll tell you honestly whether
                we can do it.
              </p>
              <div className="mt-4">
                <ContactUsButton ownerPhoneNumber={ownerPhoneNumber} />
              </div>
              <p className="text-caption mt-3 text-[var(--sf-ink-muted)]">
                Or move the pin to an address inside Lucknow.
              </p>
            </section>
          )}

          {/* ---- Outlet selector ---- */}
          {outlets.length > 0 && !isOutsideDeliveryArea && (
            <section className="rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6">
              <h2 className="text-h4 mb-4">Select outlet</h2>
              <OutletSelector
                outlets={outlets}
                cartItems={items.map((i) => ({
                  productId: i.productId,
                  name: i.name,
                  quantity: i.quantity,
                }))}
                deliveryPin={deliveryPin}
                selectedOutletId={selectedOutletId}
                onSelect={(id) => setManualOutletId(id)}
              />
            </section>
          )}

          {/* ---- Delivery time slot ---- */}
          <section className="rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6">
            <h2 className="text-h4 mb-4">Delivery time</h2>
            <div className="mb-4 flex items-center gap-3">
              <Label htmlFor="checkout-delivery-date" className="text-caption shrink-0">
                Date
              </Label>
              <Input
                id="checkout-delivery-date"
                name="deliveryDate"
                type="date"
                value={slotsResponse?.date ?? ''}
                min={getTodayIST()}
                onChange={(e) => {
                  if (!e.target.value) return;
                  if (e.target.value < getTodayIST()) {
                    toast.error("Can't select a date that has already passed.");
                    return;
                  }
                  setSlotDate(e.target.value);
                }}
                className="w-auto rounded-[var(--r-md)] border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)]"
              />
            </div>

            {isLoadingSlots ? (
              <p className="text-caption text-[var(--sf-ink-muted)]">Loading slots…</p>
            ) : slotsResponse && slotsResponse.slots.length > 0 ? (
              <>
                {!slotsResponse.hasBookableSlot && (
                  <p className="text-caption mb-3 text-[var(--sale)]">
                    No slots left for this date — please pick another date above.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {slotsResponse.slots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={!slot.bookable}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`rounded-[var(--r-md)] border px-3 py-2 text-sm transition-colors ${
                        selectedSlotId === slot.id
                          ? 'border-[var(--sf-ink)] bg-[var(--sf-ink)] text-[var(--sf-surface)]'
                          : slot.bookable
                            ? 'border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)] hover:border-[var(--sf-ink)]'
                            : 'cursor-not-allowed border-[var(--sf-border)] bg-[var(--sf-surface)] text-[var(--sf-ink-muted)] opacity-50'
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-caption text-[var(--sf-ink-muted)]">
                No delivery slots configured yet.
              </p>
            )}
          </section>

          {/* ---- Delivery address ---- */}
          <section className="rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6">
            <h2 className="text-h4 mb-4">Delivery details</h2>
            {deliveryPin ? (
              <div className="mb-5 rounded-[var(--r-md)] border border-[var(--sf-border)] bg-[var(--sf-surface-2)] p-4">
                <p className="text-caption text-[var(--sf-ink-muted)]">
                  📍 {deliveryPin.formattedAddress}
                </p>
                {(deliveryPin.locality || deliveryPin.postalCode) && (
                  <p className="text-caption mt-1.5 text-[var(--sf-ink-muted)]">
                    {[deliveryPin.locality, deliveryPin.postalCode].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="text-caption mt-2 text-[var(--sf-ink-muted)]">
                  Taken from your pin, so the delivery fee matches where we actually ride to. Move
                  the pin above to change it.
                </p>
              </div>
            ) : (
              <p className="text-caption mb-4 text-[var(--sale)]">
                Pin your delivery location above first — it&apos;s the address we deliver to.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="checkout-name" className="text-caption mb-1.5 block">
                  Name
                </Label>
                <Input
                  id="checkout-name"
                  name="name"
                  autoComplete="name"
                  required
                  value={manualAddress.recipientName}
                  onChange={(e) =>
                    setManualAddress((a) => ({ ...a, recipientName: e.target.value }))
                  }
                  className="rounded-[var(--r-md)] border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)]"
                />
              </div>
              <div>
                <Label htmlFor="checkout-phone" className="text-caption mb-1.5 block">
                  Phone
                </Label>
                <Input
                  id="checkout-phone"
                  name="tel"
                  autoComplete="tel"
                  required
                  type="tel"
                  value={manualAddress.phone}
                  onChange={(e) => setManualAddress((a) => ({ ...a, phone: e.target.value }))}
                  className="rounded-[var(--r-md)] border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)]"
                />
              </div>
              <div>
                <Label htmlFor="checkout-email" className="text-caption mb-1.5 block">
                  Email
                </Label>
                <Input
                  id="checkout-email"
                  name="email"
                  autoComplete="email"
                  required
                  type="email"
                  value={manualAddress.email}
                  onChange={(e) => setManualAddress((a) => ({ ...a, email: e.target.value }))}
                  className="rounded-[var(--r-md)] border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)]"
                />
              </div>
              <div>
                <Label htmlFor="checkout-flat-no" className="text-caption mb-1.5 block">
                  Flat / house no. (optional)
                </Label>
                <Input
                  id="checkout-flat-no"
                  name="flatNo"
                  autoComplete="address-line2"
                  value={manualAddress.flatNo}
                  onChange={(e) => setManualAddress((a) => ({ ...a, flatNo: e.target.value }))}
                  className="rounded-[var(--r-md)] border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)]"
                />
              </div>
            </div>
          </section>

          {/* ---- Coupon ---- */}
          <section className="rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6">
            <h2 className="text-h4 mb-4">Have a coupon?</h2>
            {appliedCoupon ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="btn btn-gold px-4 py-2 text-sm">{appliedCoupon} applied</span>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-caption underline underline-offset-2"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex max-w-xs gap-2">
                <Label htmlFor="checkout-coupon" className="sr-only">
                  Coupon code
                </Label>
                <Input
                  id="checkout-coupon"
                  name="coupon"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void applyCoupon();
                    }
                  }}
                  placeholder="WELCOME10"
                  className="rounded-[var(--r-md)] border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)] tracking-wide uppercase"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={isApplyingCoupon || !couponInput.trim()}
                  className="btn btn-outline shrink-0 px-4 py-2 text-sm disabled:opacity-60"
                >
                  {isApplyingCoupon ? 'Applying...' : 'Apply'}
                </button>
              </div>
            )}
            {couponMessage && (
              <p
                className={`text-caption mt-2 ${appliedCoupon ? 'text-[var(--green)]' : 'text-[var(--sale)]'}`}
              >
                {couponMessage}
              </p>
            )}
          </section>
        </div>

        {/* ---- Order summary sidebar ---- */}
        <aside className="h-fit rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface-2)] p-6 lg:sticky lg:top-24">
          <h2 className="text-h4 mb-4">Order summary</h2>

          <div className="mb-5 space-y-2 border-b border-[var(--sf-border)] pb-5">
            <p className="text-caption text-[var(--sf-ink-muted)]">Payment method</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('razorpay')}
                className={`flex-1 rounded-[var(--r-md)] border px-3 py-2 text-sm transition-colors ${
                  paymentMethod === 'razorpay'
                    ? 'border-[var(--sf-ink)] bg-[var(--sf-ink)] text-[var(--sf-surface)]'
                    : 'border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)] hover:border-[var(--sf-ink)]'
                }`}
              >
                Pay online
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('cod')}
                className={`flex-1 rounded-[var(--r-md)] border px-3 py-2 text-sm transition-colors ${
                  paymentMethod === 'cod'
                    ? 'border-[var(--sf-ink)] bg-[var(--sf-ink)] text-[var(--sf-surface)]'
                    : 'border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)] hover:border-[var(--sf-ink)]'
                }`}
              >
                Cash on delivery
              </button>
            </div>
          </div>
          {/* Quantity is chosen here rather than in the basket because
              the ceiling is whatever the chosen outlet actually holds,
              and no outlet is chosen until this page. */}
          <ul className="space-y-3">
            {items.map((item) => {
              const stock = selectedOutlet?.stock[item.productId];
              const max = stock ?? null;
              const atMax = max !== null && item.quantity >= max;
              return (
                <li key={item.productId} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 text-[var(--sf-ink-muted)]">
                    <span className="block">{item.name}</span>
                    <span className="mt-1 inline-flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Fewer ${item.name}`}
                        disabled={item.quantity <= 1}
                        onClick={() => setQuantity(item.productId, item.quantity - 1)}
                        className="grid size-6 place-items-center rounded border border-[var(--sf-border)] disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="min-w-4 text-center text-[var(--sf-ink)]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`More ${item.name}`}
                        disabled={atMax}
                        onClick={() => setQuantity(item.productId, item.quantity + 1)}
                        className="grid size-6 place-items-center rounded border border-[var(--sf-border)] disabled:opacity-40"
                      >
                        +
                      </button>
                      {/* Stepping down to zero is not a way out: the
                          minus button stops at 1. Someone who changed
                          their mind about an item needs to drop it here
                          rather than go back to the basket and lose the
                          pin, outlet and slot they already chose. */}
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="text-xs underline underline-offset-2 hover:text-[var(--sale)]"
                      >
                        Remove
                      </button>
                      {max !== null && (
                        <span className="text-xs text-[var(--price-was)]">
                          {atMax ? `only ${max} in stock here` : `${max} in stock`}
                        </span>
                      )}
                    </span>
                  </span>
                  <PriceDisplay basePrice={(item.salePrice ?? item.unitPrice) * item.quantity} />
                </li>
              );
            })}
          </ul>

          <div className="mt-5 space-y-2 border-t border-[var(--sf-border)] pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--sf-ink-muted)]">Subtotal</span>
              <span>₹{pricing ? pricing.subtotal : subtotal}</span>
            </div>
            {pricing && pricing.couponDiscount > 0 && (
              <div className="flex items-center justify-between text-sm text-[var(--green)]">
                <span>Coupon discount</span>
                <span>−₹{pricing.couponDiscount}</span>
              </div>
            )}
            {pricing && pricing.offerDiscount > 0 && (
              <div className="flex items-center justify-between text-sm text-[var(--green)]">
                <span>Offer applied</span>
                <span>−₹{pricing.offerDiscount}</span>
              </div>
            )}
            {bonusItem && (
              <div className="flex items-center justify-between text-sm text-[var(--green)]">
                <span>🎁 Free gift</span>
                <span>
                  +{bonusItem.quantity} {bonusItem.productName}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--sf-ink-muted)]">GST (5%)</span>
              <span>₹{pricing ? pricing.taxTotal : '—'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--sf-ink-muted)]">Delivery fee</span>
              <span>
                {hasDeliveryQuote ? (
                  pricing.deliveryFee > 0 ? (
                    <>
                      ₹{pricing.deliveryFee}
                      {pricing.deliveryDistanceKm != null && (
                        <span className="ml-1 text-xs text-[var(--sf-ink-muted)]">
                          ({pricing.deliveryDistanceKm} km)
                        </span>
                      )}
                    </>
                  ) : (
                    'Free'
                  )
                ) : (
                  '—'
                )}
              </span>
            </div>
            {pricing != null && pricing.nightCharge > 0 && (
              // Its own line, not folded into the delivery fee — a
              // customer who picks a late slot should see exactly what
              // changed and why.
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--sf-ink-muted)]">Night delivery charge</span>
                <span>₹{pricing.nightCharge}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-[var(--sf-border)] pt-3">
              <span className="font-display text-base">Grand total</span>
              {/* Withheld for the same reason as the fee above: a total
                  missing an unknown delivery charge is not the total. */}
              <span className="font-display text-2xl text-[var(--sf-ink)]">
                {hasDeliveryQuote ? `₹${pricing.grandTotal}` : '—'}
              </span>
            </div>
          </div>

          {blockingReason && (
            <p className="text-caption mt-6 rounded-[var(--r-md)] border border-[var(--sf-border)] bg-[var(--sf-surface)] px-3 py-2 text-[var(--sf-ink-muted)]">
              {blockingReason}
            </p>
          )}

          <button
            type="button"
            onClick={payNow}
            disabled={isPaying || blockingReason !== null}
            className="btn btn-primary mt-6 flex w-full items-center justify-center px-7 py-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPaying
              ? 'Processing...'
              : paymentMethod === 'cod'
                ? `Place order (COD)${hasDeliveryQuote ? ` ₹${pricing.grandTotal}` : ''}`
                : `Pay${hasDeliveryQuote ? ` ₹${pricing.grandTotal}` : ''}`}
          </button>

          <p className="text-caption mt-4 text-center">
            {paymentMethod === 'cod'
              ? '💵 Pay in cash on delivery'
              : '🔒 Payments secured by Razorpay'}
          </p>
        </aside>
      </div>
    </div>
  );
}
