'use client';

import Link from 'next/link';
import { CartItem } from '@/components/commerce/cart-item';
import { EmptyState } from '@/components/states/empty-state';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart-context';

const FREE_DELIVERY_THRESHOLD = 999;

/** Ch.12 §24 Cart Experience + Ch.12 §25 Free Delivery Progress. Checkout button links to /cart's own review — the actual checkout flow (address/slot/payment) is Phase 10. */
export default function CartPage() {
  const { items, subtotal, setQuantity, removeItem } = useCart();
  const remainingForFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);

  if (items.length === 0) {
    return (
      <div className="container-brand py-16">
        <EmptyState
          title="Your cart is empty"
          description="Browse our collection and find something beautiful."
          actionLabel="Shop now"
          onAction={() => {
            window.location.href = '/shop';
          }}
        />
      </div>
    );
  }

  return (
    <div className="container-brand grid gap-8 py-10 lg:grid-cols-3">
      <div className="divide-border divide-y lg:col-span-2">
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

      <div className="rounded-card border-border space-y-4 border p-6">
        {remainingForFreeDelivery > 0 ? (
          <p className="text-caption text-muted-foreground">
            Spend ₹{remainingForFreeDelivery} more to unlock free delivery.
          </p>
        ) : (
          <p className="text-caption text-success-text">You&apos;ve unlocked free delivery!</p>
        )}

        <div className="text-body text-foreground flex items-center justify-between font-semibold">
          <span>Subtotal</span>
          <span>₹{subtotal}</span>
        </div>

        <Button asChild size="lg" className="w-full">
          <Link href="/checkout">Proceed to checkout</Link>
        </Button>
      </div>
    </div>
  );
}
