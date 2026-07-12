import type { Product } from '@prana/commerce';
import { ProductCard, type ProductCardProps } from './product-card';

export interface ProductCarouselProps {
  products: Product[];
  onAddToCart?: ProductCardProps['onAddToCart'];
  onToggleWishlist?: ProductCardProps['onToggleWishlist'];
  wishlistedIds?: ReadonlySet<string>;
}

/**
 * Owner's explicit call: featured products need to read as a quick,
 * swipeable glance near the hero (not a full grid) — horizontal
 * scroll-snap rather than a carousel library, so it's real native scroll
 * behavior (momentum, keyboard, trackpad) instead of a JS-driven slider.
 */
export function ProductCarousel({
  products,
  onAddToCart,
  onToggleWishlist,
  wishlistedIds,
}: ProductCarouselProps) {
  if (products.length === 0) return null;

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {products.map((product) => (
        <div key={product.id} className="w-[68vw] shrink-0 snap-start sm:w-64">
          <ProductCard
            product={product}
            {...(onAddToCart ? { onAddToCart } : {})}
            {...(onToggleWishlist ? { onToggleWishlist } : {})}
            isWishlisted={wishlistedIds?.has(product.id) ?? false}
          />
        </div>
      ))}
    </div>
  );
}
