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

/** Ch.12 §26 Checkout Experience — "Single-page checkout. Progress indicator always visible." */
export function CheckoutFlow({ nonce }: { nonce?: string }) {
  const { items, subtotal, clear } = useCart();
  const router = useRouter();
  const [addresses, setAddresses] = React.useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = React.useState<string>('new');
  const [manualAddress, setManualAddress] = React.useState(EMPTY_ADDRESS);
  const [couponCode, setCouponCode] = React.useState('');
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

  async function payNow() {
    setIsPaying(true);
    try {
      const address =
        selectedAddressId === 'new'
          ? manualAddress
          : (() => {
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
            })();

      const response = await fetch('/api/v1/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          address,
          ...(couponCode ? { couponCode } : {}),
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
                    value={manualAddress.phone}
                    onChange={(e) => setManualAddress((a) => ({ ...a, phone: e.target.value }))}
                    className="rounded-[var(--r-md)] border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-caption mb-1.5 block">Address</Label>
                  <Input
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
                    value={manualAddress.city}
                    onChange={(e) => setManualAddress((a) => ({ ...a, city: e.target.value }))}
                    className="rounded-[var(--r-md)] border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)]"
                  />
                </div>
                <div>
                  <Label className="text-caption mb-1.5 block">Postal code</Label>
                  <Input
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
            <Input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="WELCOME10"
              className="max-w-xs rounded-[var(--r-md)] border-[var(--sf-border-strong)] bg-[var(--sf-surface-2)] uppercase tracking-wide"
            />
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

          <div className="mt-5 border-t border-[var(--sf-border)] pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[var(--sf-ink-muted)]">Subtotal</span>
              <span className="font-display text-2xl text-[var(--sf-ink)]">₹{subtotal}</span>
            </div>
            <p className="text-caption mt-2">
              Delivery fee, tax, and any coupon discount are confirmed on the payment screen.
            </p>
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
