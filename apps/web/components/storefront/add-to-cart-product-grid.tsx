'use client';

import type { Product } from '@prana/commerce';
import { toast } from 'sonner';
import { ProductCarousel } from '@/components/commerce/product-carousel';
import { ProductGrid } from '@/components/commerce/product-grid';
import { useCart } from '@/lib/cart-context';

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
  products: Product[];
  layout?: 'grid' | 'carousel';
}) {
  const { addItem } = useCart();

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

  async function handleToggleWishlist(productId: string) {
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

  if (layout === 'carousel') {
    return (
      <ProductCarousel
        products={products}
        onAddToCart={handleAddToCart}
        onToggleWishlist={handleToggleWishlist}
      />
    );
  }

  return (
    <ProductGrid
      products={products}
      onAddToCart={handleAddToCart}
      onToggleWishlist={handleToggleWishlist}
    />
  );
}
