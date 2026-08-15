'use client';

import { Heart, Minus, Phone, Plus, ShieldCheck, Truck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { PriceDisplay } from '@/components/commerce/price-display';
import { useCart } from '@/lib/cart-context';

export interface ProductActionsProps {
  productId: string;
  name: string;
  slug: string;
  color: string | null;
  image: string | null;
  basePrice: number;
  salePrice: number | null;
  /** Summed across active outlets. 0 means sold out everywhere. */
  availableQuantity: number;
}

/** Ch.12 §22: Product Information -> Price -> Delivery -> Add To Cart -> Buy Now. */
export function ProductActions({
  productId,
  name,
  slug,
  color,
  image,
  basePrice,
  salePrice,
  availableQuantity,
}: ProductActionsProps) {
  const { addItem } = useCart();
  const router = useRouter();
  const [quantity, setQuantity] = React.useState(1);

  /**
   * The listing card has always greyed out a sold-out product, but this
   * page never knew its own stock — so an out-of-stock product could be
   * added to the cart and bought straight from its product page, which
   * is the page a shared link actually lands on. Wishlist stays
   * available: saving something you cannot buy yet is the whole point.
   */
  const outOfStock = availableQuantity <= 0;
  // Never offer more than exists, even when stock is low but non-zero.
  const maxQuantity = Math.max(1, availableQuantity);

  function addToCart() {
    if (outOfStock) return;
    addItem(
      { productId, slug, name, image, unitPrice: basePrice, salePrice },
      quantity,
      availableQuantity,
    );
    toast.success(`${name} added to cart.`);
  }

  function buyNow() {
    if (outOfStock) return;
    addItem(
      { productId, slug, name, image, unitPrice: basePrice, salePrice },
      quantity,
      availableQuantity,
    );
    router.push('/cart');
  }

  async function toggleWishlist() {
    try {
      const response = await fetch('/api/v1/account/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      if (response.status === 401) {
        toast.error('Sign in to save products to your wishlist.');
        return;
      }
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to update wishlist.');
      toast.success('Added to wishlist.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to update wishlist.');
    }
  }

  return (
    <div className="flex flex-col">
      <h1 className="text-h2">{name}</h1>
      {/* Right under the title, where it answers "which one is this?"
          before the customer has to read the description. */}
      {color && (
        <p className="text-body text-muted-foreground mt-1">
          Colour: <span className="text-foreground font-medium">{color}</span>
        </p>
      )}

      <div className="mt-6">
        <PriceDisplay basePrice={basePrice} salePrice={salePrice} size="lg" />
      </div>

      <p
        className={`text-caption mt-3 font-semibold ${outOfStock ? 'text-[var(--petal)]' : 'text-[var(--ink-2)]'}`}
        // Announced so a screen-reader user learns the item is
        // unavailable before reaching the disabled buttons below.
        role="status"
      >
        {outOfStock
          ? 'No stock — currently unavailable'
          : availableQuantity <= 5
            ? `In stock — only ${availableQuantity} left`
            : 'In stock'}
      </p>

      <div className="mt-8 flex items-center gap-4">
        <span className="text-caption">Quantity</span>
        <div className="inline-flex items-center rounded-[var(--r-pill)] border border-[var(--sf-border-strong)] bg-[var(--sf-surface)]">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            disabled={outOfStock || quantity <= 1}
            className="grid size-11 place-items-center rounded-l-[var(--r-pill)] text-[var(--sf-ink)] hover:bg-[var(--sf-surface-2)] disabled:opacity-40"
          >
            <Minus className="size-4" />
          </button>
          <span
            className="font-display min-w-[3ch] text-center text-lg text-[var(--sf-ink)]"
            aria-live="polite"
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
            aria-label="Increase quantity"
            disabled={outOfStock || quantity >= maxQuantity}
            className="grid size-11 place-items-center rounded-r-[var(--r-pill)] text-[var(--sf-ink)] hover:bg-[var(--sf-surface-2)] disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={addToCart}
          disabled={outOfStock}
          className="btn btn-primary flex-1 px-7 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {outOfStock ? 'Out of stock' : 'Add to cart'}
        </button>
        <button
          type="button"
          onClick={buyNow}
          disabled={outOfStock}
          className="btn btn-gold flex-1 px-7 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Buy now
        </button>
        <button
          type="button"
          onClick={toggleWishlist}
          aria-label="Add to wishlist"
          className="btn btn-outline grid h-[52px] w-[52px] place-items-center px-0"
        >
          <Heart className="size-5" />
        </button>
      </div>

      <p className="text-caption mt-6 flex items-center gap-2">
        <span className="text-[var(--gold)]" aria-hidden="true">
          ✦
        </span>
        {outOfStock
          ? 'Save it to your wishlist and we’ll have it back soon.'
          : 'Fresh, hand-arranged, same-day delivery.'}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 border-t border-[var(--sf-border)] pt-6 sm:grid-cols-3">
        <div className="flex items-start gap-2.5">
          <Truck className="mt-0.5 size-4 shrink-0 text-[var(--gold-deep)]" aria-hidden="true" />
          <span className="text-caption">Same-day delivery on orders placed in time</span>
        </div>
        <div className="flex items-start gap-2.5">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-[var(--gold-deep)]"
            aria-hidden="true"
          />
          <span className="text-caption">Secure payment — card, UPI, or cash on delivery</span>
        </div>
        <div className="flex items-start gap-2.5">
          <Phone className="mt-0.5 size-4 shrink-0 text-[var(--gold-deep)]" aria-hidden="true" />
          <span className="text-caption">Questions? Call us any time from your orders page</span>
        </div>
      </div>
    </div>
  );
}
