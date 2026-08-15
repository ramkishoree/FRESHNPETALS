'use client';

import * as React from 'react';
import { toast } from 'sonner';
import type { ProductCardProps } from '@/components/commerce/product-card';
import { ProductCarousel } from '@/components/commerce/product-carousel';
import { ProductGrid } from '@/components/commerce/product-grid';
import { useCart } from '@/lib/cart-context';
import { useWishlist } from '@/lib/use-wishlist';

/**
 * Thin client boundary around Phase 7's `ProductGrid` — the rest of every
 * page that renders this stays a Server Component (Ch.12 §22 wants
 * product listings server-rendered for SEO); only "add to cart"/
 * "wishlist" need client interactivity. `layout="carousel"` reuses the
 * exact same cart/wishlist wiring for the homepage's swipeable featured
 * row instead of duplicating it.
 */
export function AddToCartProductGrid({
  products,
  layout = 'grid',
}: {
  products: ProductCardProps['product'][];
  layout?: 'grid' | 'carousel';
}) {
  const { addItem } = useCart();
  const { wishlistedIds, toggle } = useWishlist();

  function handleAddToCart(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product || product.availableQuantity <= 0) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.featuredImage,
      unitPrice: product.basePrice,
      salePrice: product.salePrice,
    });
    toast.success(`${product.name} added to cart.`);
  }

  if (layout === 'carousel') {
    return (
      <ProductCarousel
        products={products}
        onAddToCart={handleAddToCart}
        onToggleWishlist={(id) => void toggle(id)}
        wishlistedIds={wishlistedIds}
      />
    );
  }

  return (
    <ProductGrid
      products={products}
      onAddToCart={handleAddToCart}
      onToggleWishlist={(id) => void toggle(id)}
      wishlistedIds={wishlistedIds}
    />
  );
}
