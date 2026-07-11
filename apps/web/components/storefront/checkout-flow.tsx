'use client';

import Script from 'next/script';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { PriceDisplay } from '@/components/commerce/price-display';
import { BrandDivider } from '@/components/storefront/brand-divider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCart } from '@/lib/cart-context';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface SavedAddress {
  id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  address_line_1: string;
  city: string;
  postal_code: string;
}

const EMPTY_ADDRESS = {
  recipientName: '',
  phone: '',
  addressLine1: '',
  city: '',
  postalCode: '',
};

interface PricingBreakdown {
  subtotal: number;
  discountTotal: number;
  couponDiscount: number;
  deliveryFee: number;
  taxTotal: number;
  grandTotal: number;
}

/** Ch.12 §26 Checkout Experience — "Single-page checkout. Progress indicator always visible." */
export function CheckoutFlow({ nonce }: { nonce?: string }) {
  const { items, subtotal, clear } = useCart();
  const router = useRouter();
  const [addresses, setAddresses] = React.useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = React.useState<string>('new');
  const [manualAddress, setManualAddress] = React.useState(EMPTY_ADDRESS);
  const [couponInput, setCouponInput] = React.useState('');
  const [appliedCoupon, setAppliedCoupon] = React.useState<string | null>(null);
  const [pricing, setPricing] = React.useState<PricingBreakdown | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = React.useState(false);
  const [couponMessage, setCouponMessage] = React.useState<string | null>(null);
  const [isPaying, setIsPaying] = React.useState(false);
  const [scriptReady, setScriptReady] = React.useState(false);

  React.useEffect(() => {
    async function loadAddresses() {
      const response = await fetch('/api/v1/account/addresses');
      const body = await response.json();
      if (response.ok && body.success && body.data.length > 0) {
        setAddresses(body.data);
        setSelectedAddressId(body.data[0].id);
      }
    }
    void loadAddresses();
  }, []);

  if (items.length === 0) {
    return (
      <div className="container-brand py-14 text-center">
        <p className="text-body-lg">Add something to your cart before checking out.</p>
      </div>
    );
  }

  function resolveAddress() {
    if (selectedAddressId === 'new') return manualAddress;
    const saved = addresses.find((a) => a.id === selectedAddressId);
    return saved
      ? {
          recipientName: saved.recipient_name,
          phone: saved.phone,
          addressLine1: saved.address_line_1,
          city: saved.city,
          postalCode: saved.postal_code,
        }
      : manualAddress;
  }

  function findMissingAddressFields(address: typeof EMPTY_ADDRESS): string[] {
    const labels: Record<keyof typeof EMPTY_ADDRESS, string> = {
      recipientName: 'recipient name',
      phone: 'phone number',
      addressLine1: 'address',
      city: 'city',
      postalCode: 'postal code',
    };
    return (Object.keys(labels) as (keyof typeof EMPTY_ADDRESS)[])
      .filter((key) => address[key].trim().length === 0)
      .map((key) => labels[key]);
  }

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setPricing(null);
      setAppliedCoupon(null);
      setCouponMessage(null);
      return;
    }
    setIsApplyingCoupon(true);
    setCouponMessage(null);
    try {
      const response = await fetch('/api/v1/checkout/coupon-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          couponCode: code,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setPricing(null);
        setAppliedCoupon(null);
        setCouponMessage(body.error?.message ?? 'Could not apply that coupon.');
        return;
      }
      setPricing(body.data.pricing);
      setAppliedCoupon(body.data.appliedCouponCode);
      setCouponMessage(
        body.data.appliedCouponCode ? `"${body.data.appliedCouponCode}" applied.` : null,
      );
    } catch {
      setPricing(null);
      setAppliedCoupon(null);
      setCouponMessage('Could not apply that coupon. Please try again.');
    } finally {
      setIsApplyingCoupon(false);
    }
  }

  function removeCoupon() {
    setCouponInput('');
    setAppliedCoupon(null);
    setPricing(null);
    setCouponMessage(null);
  }

  async function payNow() {
    const address = resolveAddress();
    const missing = findMissingAddressFields(address);
    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.join(', ')}.`);
      return;
    }

    setIsPaying(true);
    try {
      const response = await fetch('/api/v1/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          address,
          ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to start checkout.');

      const { checkoutSessionId, razorpayOrderId, razorpayKeyId, amount, currency } = body.data;

      if (!scriptReady || typeof window.Razorpay === 'undefined') {
        throw new Error('Payment provider is still loading. Please try again in a moment.');
      }

      const razorpay = new window.Razorpay({
        key: razorpayKeyId,
        order_id: razorpayOrderId,
        amount,
        currency,
        name: 'Fresh & Petals',
        // Ch.8 §89 Principle 5: this handler never creates the order —
        // it only sends the customer to a page that waits for the
        // server-verified webhook to do that.
        handler: () => {
          clear();
          router.push(`/checkout/${checkoutSessionId}/processing`);
        },
        modal: {
          ondismiss: () => setIsPaying(false),
        },
      });
      razorpay.open();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to start checkout.');
      setIsPaying(false);
    }
  }

  return (
    <div className="container-brand py-14">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        {...(nonce ? { nonce } : {})}
        onReady={() => setScriptReady(true)}
        onLoad={() => setScriptReady(true)}
      />

      <header className="mb-10 text-center">
        <p className="eyebrow mb-2">Almost there</p>
        <h1 className="text-h1">Checkout</h1>
        <BrandDivider className="mt-6" />
      </header>

      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          <section className="rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6">
            <h2 className="text-h4 mb-4">Deliver to</h2>

            {addresses.length > 0 && (
              <div className="mb-6">
                <Label className="text-caption mb-1.5 block">Saved address</Label>
                <Select value={selectedAddressId} onValueChange={setSelectedAddressId}>
                  <SelectTrigger className="rounded-[var(--r-md)] border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-[var(--r-md)] border-[var(--sf-border)] bg-[var(--sf-surface)]">
                    {addresses.map((address) => (
                      <SelectItem key={address.id} value={address.id}>
                        {address.label || address.recipient_name} — {address.address_line_1},{' '}
                        {address.city}
                      </SelectItem>
                    ))}
                    <SelectItem value="new">Enter a new address</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedAddressId === 'new' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="text-caption mb-1.5 block">Recipient name</Label>
                  <Input
                    required
                    value={manualAddress.recipientName}
                    onChange={(e) =>
                      setManualAddress((a) => ({ ...a, recipientName: e.target.value }))
                    }
                    className="rounded-[var(--r-md)] border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-caption mb-1.5 block">Phone</Label>
                  <Input
                    required
                    type="tel"
                    value={manualAddress.phone}
                    onChange={(e) => setManualAddress((a) => ({ ...a, phone: e.target.value }))}
                    className="rounded-[var(--r-md)] border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-caption mb-1.5 block">Address</Label>
                  <Input
                    required
                    value={manualAddress.addressLine1}
                    onChange={(e) =>
                      setManualAddress((a) => ({ ...a, addressLine1: e.target.value }))
                    }
                    className="rounded-[var(--r-md)] border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)]"
                  />
                </div>
                <div>
                  <Label className="text-caption mb-1.5 block">City</Label>
                  <Input
                    required
                    value={manualAddress.city}
                    onChange={(e) => setManualAddress((a) => ({ ...a, city: e.target.value }))}
                    className="rounded-[var(--r-md)] border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)]"
                  />
                </div>
                <div>
                  <Label className="text-caption mb-1.5 block">Postal code</Label>
                  <Input
                    required
                    value={manualAddress.postalCode}
                    onChange={(e) =>
                      setManualAddress((a) => ({ ...a, postalCode: e.target.value }))
                    }
                    className="rounded-[var(--r-md)] border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)]"
                  />
                </div>
              </div>
            )}
          </section>

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
                <Input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void applyCoupon();
                    }
                  }}
                  placeholder="WELCOME10"
                  className="rounded-[var(--r-md)] border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)] uppercase tracking-wide"
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

        <aside className="h-fit rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface-2)] p-6 lg:sticky lg:top-24">
          <h2 className="text-h4 mb-4">Order summary</h2>
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
            {pricing && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--sf-ink-muted)]">Delivery fee</span>
                  <span>{pricing.deliveryFee > 0 ? `₹${pricing.deliveryFee}` : 'Free'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--sf-ink-muted)]">Tax</span>
                  <span>₹{pricing.taxTotal}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[var(--sf-ink-muted)]">Total</span>
              <span className="font-display text-2xl text-[var(--sf-ink)]">
                ₹{pricing ? pricing.grandTotal : subtotal}
              </span>
            </div>
            {!pricing && (
              <p className="text-caption mt-1">
                Delivery fee and tax are confirmed on the payment screen.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={payNow}
            disabled={isPaying}
            className="btn btn-primary mt-6 flex w-full items-center justify-center px-7 py-4 text-sm disabled:opacity-60"
          >
            {isPaying ? 'Processing...' : 'Pay now'}
          </button>

          <p className="text-caption mt-4 text-center">🔒 Payments secured by Razorpay</p>
        </aside>
      </div>
    </div>
  );
}
