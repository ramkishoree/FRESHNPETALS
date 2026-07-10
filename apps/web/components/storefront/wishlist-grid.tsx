'use client';

import type { Product } from '@prana/commerce';
import { toast } from 'sonner';
import { EmptyState } from '@/components/states/empty-state';
import { ProductGrid } from '@/components/commerce/product-grid';
import { useCart } from '@/lib/cart-context';

interface WishlistProductRow {
  id: string;
  slug: string;
  name: string;
  featured_image: string | null;
  status: Product['status'];
  product_prices:
    | { base_price: string | number; sale_price: string | number | null }
    | { base_price: string | number; sale_price: string | number | null }[]
    | null;
}

interface WishlistEntry {
  id: string;
  products: WishlistProductRow | WishlistProductRow[] | null;
}

function mapEntry(entry: WishlistEntry): Product | null {
  const product = Array.isArray(entry.products) ? entry.products[0] : entry.products;
  if (!product) return null;
  const priceRow = Array.isArray(product.product_prices)
    ? product.product_prices[0]
    : product.product_prices;
  return {
    id: product.id,
    sku: '',
    slug: product.slug,
    name: product.name,
    shortDescription: null,
    featuredImage: product.featured_image,
    status: product.status,
    basePrice: priceRow ? Number(priceRow.base_price) : 0,
    salePrice: priceRow?.sale_price != null ? Number(priceRow.sale_price) : null,
  };
}

export function WishlistGrid({ entries }: { entries: WishlistEntry[] }) {
  const { addItem } = useCart();
  const products = entries.map(mapEntry).filter((product): product is Product => product != null);

  async function handleRemove(productId: string) {
    try {
      const response = await fetch(`/api/v1/account/wishlist/${productId}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to remove.');
      toast.success('Removed from wishlist.');
      window.location.reload();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to remove.');
    }
  }

  function handleAddToCart(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
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

  if (products.length === 0) {
    return (
      <EmptyState title="Your wishlist is empty" description="Save products you love for later." />
    );
  }

  return (
    <ProductGrid
      products={products}
      onAddToCart={handleAddToCart}
      onToggleWishlist={handleRemove}
      wishlistedIds={new Set(products.map((product) => product.id))}
    />
  );
}
