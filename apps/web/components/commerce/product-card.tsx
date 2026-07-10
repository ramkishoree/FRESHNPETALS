import type { Product } from '@prana/commerce';
import { Heart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { DiscountBadge } from './discount-badge';
import { PriceDisplay } from './price-display';

export interface ProductCardProps {
  product: Product;
  onAddToCart?: (productId: string) => void;
  onToggleWishlist?: (productId: string) => void;
  isWishlisted?: boolean;
}

/**
 * Ch.12 §82. Ch.5.20: large image, price, delivery badge, add-to-cart,
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
    <Card className="rounded-card duration-250 group overflow-hidden p-0 transition-shadow hover:shadow-md">
      <div className="rounded-image bg-muted relative aspect-square overflow-hidden">
        <Link href={`/product/${product.slug}`} className="block size-full">
          {product.featuredImage ? (
            <Image
              src={product.featuredImage}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="duration-400 object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="text-caption text-muted-foreground flex size-full items-center justify-center">
              No image
            </div>
          )}
        </Link>
        <div className="absolute left-3 top-3">
          <DiscountBadge basePrice={product.basePrice} salePrice={product.salePrice} />
        </div>
        {onToggleWishlist && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-3 top-3 size-8 rounded-full"
            aria-pressed={isWishlisted}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            onClick={() => onToggleWishlist(product.id)}
          >
            <Heart className={isWishlisted ? 'fill-destructive text-destructive' : ''} />
          </Button>
        )}
      </div>

      <CardContent className="space-y-2 px-4 pt-4">
        <Link
          href={`/product/${product.slug}`}
          className="text-body line-clamp-2 font-medium hover:underline"
        >
          {product.name}
        </Link>
        <PriceDisplay basePrice={product.basePrice} salePrice={product.salePrice} />
      </CardContent>

      {onAddToCart && (
        <CardFooter className="px-4 pb-4">
          <Button type="button" className="w-full" onClick={() => onAddToCart(product.id)}>
            Add to cart
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
