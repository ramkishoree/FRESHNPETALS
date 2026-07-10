'use client';

import { Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { PriceDisplay } from '@/components/commerce/price-display';
import { Button } from '@/components/ui/button';
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
    <div className="space-y-4">
      <h1 className="text-h2 text-foreground font-bold">{name}</h1>
      {shortDescription && <p className="text-body text-muted-foreground">{shortDescription}</p>}
      <PriceDisplay basePrice={basePrice} salePrice={salePrice} size="lg" />

      <div className="flex items-center gap-3">
        <div className="rounded-button border-input flex items-center border">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            -
          </Button>
          <span className="text-body w-8 text-center">{quantity}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setQuantity((q) => q + 1)}
          >
            +
          </Button>
        </div>
        <Button type="button" onClick={addToCart} className="flex-1">
          Add to cart
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={toggleWishlist}
          aria-label="Add to wishlist"
        >
          <Heart className="size-4" />
        </Button>
      </div>

      <Button type="button" variant="secondary" size="lg" onClick={buyNow} className="w-full">
        Buy now
      </Button>
    </div>
  );
}
