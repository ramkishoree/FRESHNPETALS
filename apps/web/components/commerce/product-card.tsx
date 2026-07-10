import type { Product } from '@prana/commerce';
import { Heart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { DiscountBadge } from './discount-badge';
import { PriceDisplay } from './price-display';

export interface ProductCardProps {
  product: Product;
  onAddToCart?: (productId: string) => void;
  onToggleWishlist?: (productId: string) => void;
  isWishlisted?: boolean;
}

/**
 * Ch.12 §82. Ch.5.20: large image, price, discount badge, add-to-cart,
 * wishlist, hover effect — CLS must stay 0 (Ch.12 §21), hence the fixed
 * aspect-ratio image wrapper rather than an intrinsic-sized <img>.
 */
export function ProductCard({
  product,
  onAddToCart,
  onToggleWishlist,
  isWishlisted,
}: ProductCardProps) {
  return (
    <article className="card-brand group flex flex-col overflow-hidden">
      <div className="relative">
        <Link href={`/product/${product.slug}`} className="block" aria-label={product.name}>
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--sf-surface-2)]">
            {product.featuredImage ? (
              <Image
                src={product.featuredImage}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover transition-transform duration-700 ease-[var(--ease)] group-hover:scale-[1.04]"
              />
            ) : (
              <div className="text-caption flex h-full w-full items-center justify-center">
                No image
              </div>
            )}
          </div>
        </Link>

        <div className="pointer-events-none absolute left-3 top-3">
          <DiscountBadge basePrice={product.basePrice} salePrice={product.salePrice} />
        </div>

        {onToggleWishlist && (
          <button
            type="button"
            onClick={() => onToggleWishlist(product.id)}
            aria-pressed={isWishlisted}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            className="bg-[var(--warm-white)]/90 absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-[var(--sf-border)] text-[var(--sf-ink)] backdrop-blur transition-colors hover:border-[var(--gold)] hover:text-[var(--sale)] focus-visible:outline"
          >
            <Heart className="size-[18px]" fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-xl leading-tight text-[var(--sf-ink)]">
          <Link href={`/product/${product.slug}`} className="hover:text-[var(--gold-deep)]">
            {product.name}
          </Link>
        </h3>

        {product.shortDescription && (
          <p className="mt-1.5 line-clamp-2 text-sm text-[var(--sf-ink-muted)]">
            {product.shortDescription}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <PriceDisplay basePrice={product.basePrice} salePrice={product.salePrice} />

          {onAddToCart && (
            <button
              type="button"
              onClick={() => onAddToCart(product.id)}
              className="btn btn-gold shrink-0 px-5 py-2.5 text-sm"
            >
              Add
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
