'use client';

import type { Product } from '@prana/commerce';
import { Heart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';
import { PriceDisplay } from './price-display';
import { StarRating } from './star-rating';

export interface ProductCardProps {
  /**
   * Rating aggregates ride along optionally: the storefront listing
   * carries them (`StorefrontProduct`), other callers pass a plain
   * `Product` and simply show no rating.
   */
  product: Product & { averageRating?: number | null; approvedReviewCount?: number };
  /**
   * Load this image eagerly, at high priority, instead of lazily.
   *
   * `next/image` lazy-loads by default, which is right for everything
   * below the fold and wrong for the first row: the browser could not
   * discover the largest visible image until layout had run, costing
   * ~585ms of pure "load delay" on the homepage's LCP. Callers set this
   * for the cards that are visible without scrolling.
   */
  priority?: boolean;
  onAddToCart?: (productId: string) => void;
  onToggleWishlist?: (productId: string) => void;
  isWishlisted?: boolean;
}

/**
 * Editorial "plate" treatment (owner's reference design): a plain
 * image plate with a tag overlay, then a meta row under a hairline —
 * name and price only, no card border/shadow. Add-to-cart stays (real
 * function, just restyled as a quiet text action instead of a pill) and
 * wishlist stays as a corner glyph — CLS must stay 0, hence the fixed
 * aspect-ratio image wrapper rather than an intrinsic-sized <img>.
 */
const HOVER_INTERVAL_MS = 700;

export function ProductCard({
  product,
  priority = false,
  onAddToCart,
  onToggleWishlist,
  isWishlisted,
}: ProductCardProps) {
  const outOfStock = product.availableQuantity <= 0;
  const images = product.images.length > 0 ? product.images : [];
  const [hoverIndex, setHoverIndex] = React.useState(0);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  function startHoverCycle() {
    if (images.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setHoverIndex((previous) => (previous + 1) % images.length);
    }, HOVER_INTERVAL_MS);
  }

  function stopHoverCycle() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setHoverIndex(0);
  }

  React.useEffect(() => stopHoverCycle, []);

  const activeImage = images[hoverIndex] ?? product.featuredImage;

  return (
    <article className="plate" onMouseEnter={startHoverCycle} onMouseLeave={stopHoverCycle}>
      <div className="plate-img">
        <Link href={`/product/${product.slug}`} className="block" aria-label={product.name}>
          {activeImage ? (
            <Image
              src={activeImage}
              alt={product.name}
              width={600}
              height={750}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              priority={priority}
              // Only meaningful alongside priority; tells the browser this
              // is the image worth fetching first, not merely eagerly.
              {...(priority ? { fetchPriority: 'high' as const } : {})}
              className={outOfStock ? 'grayscale' : ''}
            />
          ) : (
            <div className="text-caption flex aspect-[4/5] w-full items-center justify-center">
              No image
            </div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/35">
              <span className="text-caption rounded-full bg-[var(--ink)] px-4 py-1.5 text-white not-italic">
                Out of stock
              </span>
            </div>
          )}
        </Link>
        {images.length > 1 && (
          <div className="plate-dots" aria-hidden="true">
            {images.map((url, index) => (
              <span key={url} className={index === hoverIndex ? 'is-active' : ''} />
            ))}
          </div>
        )}

        {onToggleWishlist && (
          <button
            type="button"
            onClick={() => onToggleWishlist(product.id)}
            aria-pressed={isWishlisted}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            className={`absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-[var(--paper)]/85 backdrop-blur transition-colors focus-visible:outline ${
              isWishlisted ? 'text-[var(--sage)]' : 'text-[var(--ink)] hover:text-[var(--sage)]'
            }`}
          >
            <Heart className="size-4" fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      <div className="plate-meta">
        <Link href={`/product/${product.slug}`} className="plate-nm hover:text-[var(--gold-deep)]">
          {product.name}
          {/* Colour sits with the name, not as a separate row: two
              arrangements can share almost the same title, and the
              colour is what actually tells them apart at a glance. */}
          {product.color && (
            <span className="text-muted-foreground font-normal"> · {product.color}</span>
          )}
        </Link>
        <span className="plate-pr">
          <PriceDisplay basePrice={product.basePrice} salePrice={product.salePrice} />
        </span>
      </div>

      {/* Nothing at all when unreviewed, rather than an empty row of grey
          stars — a new product should not look like a badly rated one. */}
      {product.averageRating != null && product.approvedReviewCount ? (
        <StarRating
          rating={product.averageRating}
          count={product.approvedReviewCount}
          size="sm"
          className="mt-1"
        />
      ) : null}

      {onAddToCart && (
        <button
          type="button"
          disabled={outOfStock}
          onClick={(event) => {
            event.preventDefault();
            onAddToCart(product.id);
          }}
          className="act mt-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {outOfStock ? 'Sold out' : 'Add to basket'}
        </button>
      )}
    </article>
  );
}
