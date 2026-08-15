import { ProductCard, type ProductCardProps } from './product-card';

export interface ProductCarouselProps {
  products: ProductCardProps['product'][];
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
    <div className="relative -mx-4 sm:mx-0">
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:px-0">
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
      {/* Signals "swipe for more" instead of letting the next card's text
       *  cut off abruptly at the viewport edge, which read as broken on
       *  mobile rather than as an intentional peek. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[var(--paper,var(--background))] to-transparent sm:hidden"
      />
    </div>
  );
}
