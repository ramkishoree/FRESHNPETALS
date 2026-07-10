'use client';

import Script from 'next/script';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { PriceDisplay } from '@/components/commerce/price-display';
import { EmptyState } from '@/components/states/empty-state';
import { Button } from '@/components/ui/button';
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
      <EmptyState
        title="Your cart is empty"
        description="Add something to your cart before checking out."
      />
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
    <div className="grid gap-8 lg:grid-cols-3">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        {...(nonce ? { nonce } : {})}
        onReady={() => setScriptReady(true)}
        onLoad={() => setScriptReady(true)}
      />

      <div className="space-y-6 lg:col-span-2">
        <section className="space-y-3">
          <h2 className="text-h4 text-foreground font-semibold">Delivery address</h2>
          {addresses.length > 0 && (
            <Select value={selectedAddressId} onValueChange={setSelectedAddressId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {addresses.map((address) => (
                  <SelectItem key={address.id} value={address.id}>
                    {address.label || address.recipient_name} — {address.address_line_1},{' '}
                    {address.city}
                  </SelectItem>
                ))}
                <SelectItem value="new">Enter a new address</SelectItem>
              </SelectContent>
            </Select>
          )}

          {selectedAddressId === 'new' && (
            <div className="rounded-card border-border grid gap-3 border p-4">
              <div className="grid gap-1.5">
                <Label htmlFor="recipientName">Recipient name</Label>
                <Input
                  id="recipientName"
                  value={manualAddress.recipientName}
                  onChange={(e) =>
                    setManualAddress((a) => ({ ...a, recipientName: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={manualAddress.phone}
                  onChange={(e) => setManualAddress((a) => ({ ...a, phone: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="addressLine1">Address</Label>
                <Input
                  id="addressLine1"
                  value={manualAddress.addressLine1}
                  onChange={(e) =>
                    setManualAddress((a) => ({ ...a, addressLine1: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={manualAddress.city}
                    onChange={(e) => setManualAddress((a) => ({ ...a, city: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="postalCode">Postal code</Label>
                  <Input
                    id="postalCode"
                    value={manualAddress.postalCode}
                    onChange={(e) =>
                      setManualAddress((a) => ({ ...a, postalCode: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-h4 text-foreground font-semibold">Order review</h2>
          <div className="divide-border rounded-card border-border divide-y border">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-body text-foreground font-medium">{item.name}</p>
                  <p className="text-caption text-muted-foreground">Qty {item.quantity}</p>
                </div>
                <PriceDisplay basePrice={(item.salePrice ?? item.unitPrice) * item.quantity} />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <Label htmlFor="coupon">Coupon code</Label>
          <Input
            id="coupon"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="WELCOME10"
          />
        </section>
      </div>

      <div className="rounded-card border-border space-y-4 border p-6">
        <div className="text-body text-foreground flex items-center justify-between font-semibold">
          <span>Subtotal</span>
          <span>₹{subtotal}</span>
        </div>
        <p className="text-caption text-muted-foreground">
          Delivery fee, tax, and any coupon discount are confirmed on the payment screen.
        </p>
        <Button size="lg" className="w-full" disabled={isPaying} onClick={payNow}>
          {isPaying ? 'Processing...' : 'Pay now'}
        </Button>
      </div>
    </div>
  );
}
