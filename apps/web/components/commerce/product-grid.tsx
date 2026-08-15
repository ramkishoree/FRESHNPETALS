import { EmptyState } from '@/components/states/empty-state';
import { ProductCard, type ProductCardProps } from './product-card';

export interface ProductGridProps {
  products: ProductCardProps['product'][];
  onAddToCart?: ProductCardProps['onAddToCart'];
  onToggleWishlist?: ProductCardProps['onToggleWishlist'];
  wishlistedIds?: ReadonlySet<string>;
  emptyMessage?: string;
}

/** Ch.12 §82/§19: mobile-first responsive grid (Ch.5.4). */
/** First row across the widest grid layout. */
const PRIORITY_IMAGE_COUNT = 3;

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
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          // The first row is above the fold on every breakpoint (3 up on
          // desktop, 1 up on mobile), so these are the LCP candidates.
          // Everything after stays lazy — eager-loading the whole grid
          // would just move the contention rather than remove it.
          priority={index < PRIORITY_IMAGE_COUNT}
          {...(onAddToCart ? { onAddToCart } : {})}
          {...(onToggleWishlist ? { onToggleWishlist } : {})}
          isWishlisted={wishlistedIds?.has(product.id) ?? false}
        />
      ))}
    </div>
  );
}
