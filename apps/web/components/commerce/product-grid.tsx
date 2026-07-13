import type { Product } from '@prana/commerce';
import { EmptyState } from '@/components/states/empty-state';
import { ProductCard, type ProductCardProps } from './product-card';

export interface ProductGridProps {
  products: Product[];
  onAddToCart?: ProductCardProps['onAddToCart'];
  onToggleWishlist?: ProductCardProps['onToggleWishlist'];
  wishlistedIds?: ReadonlySet<string>;
  emptyMessage?: string;
}

/** Ch.12 §82/§19: mobile-first responsive grid (Ch.5.4). */
export function ProductGrid({
  products,
  onAddToCart,
  onToggleWishlist,
  wishlistedIds,
  emptyMessage = 'No products match your filters yet.',
}: ProductGridProps) {
  if (products.length === 0) {
    return <EmptyState title="No products found" description={emptyMessage} />;
  }

  return (
    <div className="plates">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          {...(onAddToCart ? { onAddToCart } : {})}
          {...(onToggleWishlist ? { onToggleWishlist } : {})}
          isWishlisted={wishlistedIds?.has(product.id) ?? false}
        />
      ))}
    </div>
  );
}
