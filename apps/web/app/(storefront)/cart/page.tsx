'use client';

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { CartItem } from '@/components/commerce/cart-item';
import { BrandDivider } from '@/components/storefront/brand-divider';
import { useCart } from '@/lib/cart-context';

const FREE_DELIVERY_THRESHOLD = 999;

/** Ch.12 §24 Cart Experience + Ch.12 §25 Free Delivery Progress. */
export default function CartPage() {
  const { items, subtotal, setQuantity, removeItem } = useCart();

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
        <Link href="/shop" className="btn btn-primary inline-flex px-8 py-3.5 text-sm">
          Shop now
        </Link>
      </div>
    );
  }

  const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const progress = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100);

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
              onQuantityChange={(quantity) => setQuantity(item.productId, quantity)}
              onRemove={() => removeItem(item.productId)}
            />
          ))}
        </div>

        <aside className="h-fit rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface-2)] p-6 lg:sticky lg:top-24">
          <div className="mb-6">
            {remaining > 0 ? (
              <p className="text-sm text-[var(--sf-ink-muted)]">
                Add <span className="font-display text-lg text-[var(--sf-ink)]">₹{remaining}</span>{' '}
                more for free delivery.
              </p>
            ) : (
              <p className="text-success-text text-sm font-medium">
                ✦ You&rsquo;ve unlocked free delivery.
              </p>
            )}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--sf-border)]">
              <div
                className="h-full rounded-full bg-[var(--gold)] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-[var(--sf-ink-muted)]">Subtotal</span>
            <span className="font-display text-xl text-[var(--sf-ink)]">₹{subtotal}</span>
          </div>

          <Link
            href="/checkout"
            className="btn btn-primary mt-6 flex w-full items-center justify-center px-7 py-3.5 text-sm"
          >
            Proceed to checkout
          </Link>
          <Link
            href="/shop"
            className="text-caption mt-3 block text-center text-[var(--gold-deep)] underline-offset-4 hover:underline"
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
