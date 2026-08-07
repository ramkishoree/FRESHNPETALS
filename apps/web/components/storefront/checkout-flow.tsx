'use client';

import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { PriceDisplay } from '@/components/commerce/price-display';
import { formatSavedAddress, type SavedAddress } from '@/components/storefront/address-manager';
import { DeliveryMap, type MapLocation } from '@/components/storefront/delivery-map';
import { OutletSelector, type OutletWithStock } from '@/components/storefront/outlet-selector';
import { BrandDivider } from '@/components/storefront/brand-divider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/lib/cart-context';

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
export function CheckoutFlow({ nonce }: { nonce?: string }) {
  const { items, subtotal, clear } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();

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

  // ---- Saved address state ---------------------------------------------------
  // Only addresses that carry a map pin are offered: without lat/lng
  // there's nothing to restore, and the delivery fee is computed from the
  // pin. (Rows saved before migration 0066 can lack one.)
  const [savedAddresses, setSavedAddresses] = React.useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | null>(null);
  const [pinTarget, setPinTarget] = React.useState<{ lat: number; lng: number } | null>(null);

  // ---- Outlet selection state ------------------------------------------------
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

  /** Coordinates from the delivery pin (Google Maps). If the pin hasn't
   *  been placed yet, returns null and the server falls back to the
   *  standard flat delivery fee. */
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
  const nearestOutletId = React.useMemo(() => {
    if (!deliveryPin || outlets.length === 0) return null;
    let nearest: OutletWithStock | undefined = outlets[0];
    let minDist = Infinity;
    for (const o of outlets) {
      const dLat = ((o.latitude - deliveryPin.lat) * Math.PI) / 180;
      const dLon = ((o.longitude - deliveryPin.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((deliveryPin.lat * Math.PI) / 180) *
          Math.cos((o.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (dist < minDist) {
        minDist = dist;
        nearest = o;
      }
    }
    return nearest?.id ?? null;
  }, [deliveryPin, outlets]);

  const selectedOutletId = manualOutletId ?? nearestOutletId;

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

  // Load the customer's saved addresses. 401s for a guest checkout —
  // that's expected, and just means no picker is offered.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/account/addresses');
        const body = await res.json();
        if (cancelled || !res.ok || !body.success) return;
        const usable = (body.data as SavedAddress[]).filter(
          (address) => address.latitude != null && address.longitude != null,
        );
        setSavedAddresses(usable);
      } catch {
        // Non-critical — the map is always available as the primary path.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Replay a saved address: move the pin, and fill the details form. */
  function applySavedAddress(address: SavedAddress) {
    const lat = Number(address.latitude);
    const lng = Number(address.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    setSelectedAddressId(address.id);
    setPinTarget({ lat, lng });
    setDeliveryPin({ lat, lng, formattedAddress: address.address_line_1 });
    setManualAddress((current) => ({
      ...current,
      recipientName: address.recipient_name,
      phone: address.phone,
      flatNo: address.address_line_2 ?? '',
    }));
  }

  // Re-fetch pricing when outlet selection or delivery pin changes.
  React.useEffect(() => {
    if (items.length === 0) return;
    void (async () => {
      await loadPricing(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutletId, deliveryPin, items.length]);

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
        name: 'Fresh & Petals',
        handler: () => {
          clear();
          router.push(`/checkout/${checkoutSessionId}/processing${guestSuffix}`);
        },
        modal: {
          // Razorpay's own widget can show a failure/retry screen and close
          // itself (calling this instead of `handler`) even when the charge
          // actually succeeded on the bank's side — our webhook is the only
          // source of truth for whether the order went through, never this
          // client-side callback. Sending the customer to the same polling
          // page `handler` uses (rather than just resetting the form) means
          // a real success still resolves to their order confirmation; a
          // real cancellation still resolves to the cart via the session's
          // 'cancelled'/'expired' status — either way they see what
          // actually happened instead of losing all visibility into it.
          ondismiss: () => {
            setIsPaying(false);
            router.push(`/checkout/${checkoutSessionId}/processing${guestSuffix}`);
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
        router.push(
          `/checkout/${checkoutSessionId}/processing${guestSuffix ? `${guestSuffix}&` : '?'}attempt=failed`,
        );
      });

      razorpay.open();
    },
    [clear, router],
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

  if (items.length === 0) {
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
        clear();
        const codGuestSuffix = body.data.guestToken
          ? `?t=${encodeURIComponent(body.data.guestToken)}`
          : '';
        router.push(`/checkout/${body.data.checkoutSessionId}/processing${codGuestSuffix}`);
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
          {/* ---- Saved addresses ---- */}
          {savedAddresses.length > 0 && (
            <section className="rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6">
              <h2 className="text-h4 mb-4">Deliver to a saved address</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {savedAddresses.map((address) => {
                  const isSelected = selectedAddressId === address.id;
                  return (
                    <button
                      key={address.id}
                      type="button"
                      onClick={() => applySavedAddress(address)}
                      aria-pressed={isSelected}
                      className={`rounded-[var(--r-md)] border p-3 text-left transition-colors ${
                        isSelected
                          ? 'border-[var(--sf-ink)] bg-[var(--sf-surface-2)]'
                          : 'border-[var(--sf-border-strong)] hover:border-[var(--sf-ink)]'
                      }`}
                    >
                      <span className="block text-sm font-medium">
                        {address.label || 'Address'}
                        {address.is_default ? ' · Default' : ''}
                      </span>
                      <span className="text-caption mt-0.5 block text-[var(--sf-ink-muted)]">
                        {formatSavedAddress(address)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-caption mt-3 text-[var(--sf-ink-muted)]">
                Or pin a new location on the map below.
              </p>
            </section>
          )}

          {/* ---- Pin your delivery location (Google Maps) ---- */}
          <section className="rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6">
            <h2 className="text-h4 mb-4">Pin your delivery location</h2>
            <DeliveryMap
              onLocationChange={(loc) => {
                // Any manual pin move means they're no longer on the
                // saved address they picked.
                setSelectedAddressId(null);
                setDeliveryPin(loc);
              }}
              pinTo={pinTarget}
            />
          </section>

          {/* ---- Outlet selector ---- */}
          {outlets.length > 0 && (
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
              <p className="text-caption mb-4 text-[var(--sf-ink-muted)]">
                📍 {deliveryPin.formattedAddress}
              </p>
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
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.productId} className="flex justify-between gap-3 text-sm">
                <span className="text-[var(--sf-ink-muted)]">
                  {item.name}
                  <span className="text-[var(--price-was)]"> × {item.quantity}</span>
                </span>
                <PriceDisplay basePrice={(item.salePrice ?? item.unitPrice) * item.quantity} />
              </li>
            ))}
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
                {pricing ? (
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
                  <span className="text-xs text-[var(--sf-ink-muted)]">
                    {deliveryPin ? 'Calculating…' : 'Pin your location first'}
                  </span>
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
              <span className="font-display text-2xl text-[var(--sf-ink)]">
                ₹{pricing ? pricing.grandTotal : subtotal}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={payNow}
            disabled={isPaying}
            className="btn btn-primary mt-6 flex w-full items-center justify-center px-7 py-4 text-sm disabled:opacity-60"
          >
            {isPaying
              ? 'Processing...'
              : paymentMethod === 'cod'
                ? `Place order (COD) ₹${pricing ? pricing.grandTotal : subtotal}`
                : `Pay ₹${pricing ? pricing.grandTotal : subtotal}`}
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
