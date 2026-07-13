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
  shortDescription: string | null;
  image: string | null;
  basePrice: number;
  salePrice: number | null;
}

/** Ch.12 §22: Product Information -> Price -> Delivery -> Add To Cart -> Buy Now. */
export function ProductActions({
  productId,
  name,
  slug,
  shortDescription,
  image,
  basePrice,
  salePrice,
}: ProductActionsProps) {
  const { addItem } = useCart();
  const router = useRouter();
  const [quantity, setQuantity] = React.useState(1);

  function addToCart() {
    addItem({ productId, slug, name, image, unitPrice: basePrice, salePrice }, quantity);
    toast.success(`${name} added to cart.`);
  }

  function buyNow() {
    addItem({ productId, slug, name, image, unitPrice: basePrice, salePrice }, quantity);
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

      {shortDescription && <p className="text-body-lg mt-3 max-w-prose">{shortDescription}</p>}

      <div className="mt-6">
        <PriceDisplay basePrice={basePrice} salePrice={salePrice} size="lg" />
      </div>

      <div className="mt-8 flex items-center gap-4">
        <span className="text-caption">Quantity</span>
        <div className="inline-flex items-center rounded-[var(--r-pill)] border border-[var(--sf-border-strong)] bg-[var(--sf-surface)]">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            disabled={quantity <= 1}
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
            onClick={() => setQuantity((q) => q + 1)}
            aria-label="Increase quantity"
            className="grid size-11 place-items-center rounded-r-[var(--r-pill)] text-[var(--sf-ink)] hover:bg-[var(--sf-surface-2)]"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={addToCart}
          className="btn btn-primary flex-1 px-7 py-3.5 text-sm"
        >
          Add to cart
        </button>
        <button type="button" onClick={buyNow} className="btn btn-gold flex-1 px-7 py-3.5 text-sm">
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
        Fresh, hand-arranged, same-day delivery.
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
