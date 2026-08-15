'use client';

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { CartItem } from '@/components/commerce/cart-item';
import { BrandDivider } from '@/components/storefront/brand-divider';
import { CartWishlist } from '@/components/storefront/cart-wishlist';
import { clearBuyNowItem } from '@/lib/buy-now';
import { useCart } from '@/lib/cart-context';

/** Ch.12 §24 Cart Experience. Delivery fee is distance-based (₹50 for the
 * first 5km, +₹5/km beyond — see packages/commerce/src/domain/checkout.ts)
 * and can only be computed once the customer drops a delivery pin at
 * checkout, so the cart itself just states the pricing model rather than
 * a progress bar toward a threshold that no longer exists. */
export default function CartPage() {
  const { items, subtotal, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <div className="container-brand py-24 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full border border-[var(--sf-border)] bg-[var(--sf-surface)] text-[var(--gold-deep)]">
          <ShoppingBag className="size-7" />
        </div>
        <h1 className="text-h2 mt-6">Your basket is empty</h1>
        <p className="text-body-lg mx-auto mt-2 max-w-sm">
          A room always feels warmer with flowers in it. Let&rsquo;s fix that.
        </p>
        <BrandDivider className="my-8" />
        <Link href="/" className="btn btn-primary inline-flex px-8 py-3.5 text-sm">
          Shop now
        </Link>

        {/* An empty basket is exactly when saved items are worth seeing. */}
        <div className="mx-auto mt-12 max-w-3xl text-left">
          <CartWishlist />
        </div>
      </div>
    );
  }

  return (
    <div className="container-brand py-14">
      <header className="mb-8">
        <p className="eyebrow mb-2">Your basket</p>
        <h1 className="text-h1">Ready to bloom</h1>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div className="divide-y divide-[var(--sf-border)] rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] px-5">
          {items.map((item) => (
            <CartItem
              key={item.productId}
              productName={item.name}
              productImage={item.image}
              quantity={item.quantity}
              unitPrice={item.salePrice ?? item.unitPrice}
              // No stepper here on purpose: how many you can have depends
              // on the outlet fulfilling the order, and that isn't chosen
              // until checkout. Offering a limit here would either be
              // wrong or would have to guess an outlet on the customer's
              // behalf.
              onRemove={() => removeItem(item.productId)}
            />
          ))}
        </div>

        <aside className="h-fit rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface-2)] p-6 lg:sticky lg:top-24">
          <p className="mb-6 text-sm text-[var(--sf-ink-muted)]">
            Delivery is <span className="text-[var(--sf-ink)]">₹50</span> for the first 5km, plus
            ₹5/km beyond that — you&rsquo;ll see the exact fee once you set your delivery location
            at checkout.
          </p>

          <div className="flex justify-between text-sm">
            <span className="text-[var(--sf-ink-muted)]">Subtotal</span>
            <span className="font-display text-xl text-[var(--sf-ink)]">₹{subtotal}</span>
          </div>

          <Link
            href="/checkout"
            // Checking out from the basket means the basket is the order.
            // Dropping any leftover buy-now item stops a single product
            // bought earlier in this tab from hijacking the whole
            // checkout — and this is the order that empties the basket.
            onClick={() => clearBuyNowItem()}
            className="btn btn-primary mt-6 flex w-full items-center justify-center px-7 py-3.5 text-sm"
          >
            Proceed to checkout
          </Link>
          <Link
            href="/"
            className="text-caption mt-3 block text-center text-[var(--gold-deep)] underline-offset-4 hover:underline"
          >
            Continue shopping
          </Link>
        </aside>
      </div>

      <CartWishlist />
    </div>
  );
}
