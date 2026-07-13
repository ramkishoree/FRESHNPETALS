import type { Product } from '@prana/commerce';
import { Heart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { PriceDisplay } from './price-display';

export interface ProductCardProps {
  product: Product;
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
export function ProductCard({
  product,
  onAddToCart,
  onToggleWishlist,
  isWishlisted,
}: ProductCardProps) {
  const outOfStock = product.availableQuantity <= 0;

  return (
    <article className="plate">
      <div className="plate-img">
        <Link href={`/product/${product.slug}`} className="block" aria-label={product.name}>
          {product.featuredImage ? (
            <Image
              src={product.featuredImage}
              alt={product.name}
              width={600}
              height={750}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
        {product.shortDescription && <span className="plate-tag">{product.shortDescription}</span>}

        {onToggleWishlist && (
          <button
            type="button"
            onClick={() => onToggleWishlist(product.id)}
            aria-pressed={isWishlisted}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            className="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-[var(--paper)]/85 text-[var(--ink)] backdrop-blur transition-colors hover:text-[var(--petal)] focus-visible:outline"
          >
            <Heart className="size-4" fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      <div className="plate-meta">
        <Link href={`/product/${product.slug}`} className="plate-nm hover:text-[var(--gold-deep)]">
          {product.name}
        </Link>
        <span className="plate-pr">
          <PriceDisplay basePrice={product.basePrice} salePrice={product.salePrice} />
        </span>
      </div>

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
