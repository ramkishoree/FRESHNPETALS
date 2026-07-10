import { Minus, Plus, X } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { PriceDisplay } from './price-display';

export interface CartItemProps {
  productName: string;
  productImage?: string | null;
  quantity: number;
  unitPrice: number;
  onQuantityChange?: (quantity: number) => void;
  onRemove?: () => void;
}

/** Ch.12 §82. Ch.8 §8.9: cart totals are always revalidated server-side at
 * checkout — quantity changes here are optimistic UI only. */
export function CartItem({
  productName,
  productImage,
  quantity,
  unitPrice,
  onQuantityChange,
  onRemove,
}: CartItemProps) {
  return (
    <div className="flex items-center gap-4 py-4">
      <div className="rounded-image bg-muted relative size-20 shrink-0 overflow-hidden">
        {productImage && (
          <Image src={productImage} alt={productName} fill sizes="80px" className="object-cover" />
        )}
      </div>

      <div className="flex-1 space-y-1">
        <p className="text-foreground font-medium">{productName}</p>
        <PriceDisplay basePrice={unitPrice} size="sm" />
      </div>

      {onQuantityChange && (
        <div className="rounded-button border-input flex items-center gap-1 border">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Decrease quantity"
            disabled={quantity <= 1}
            onClick={() => onQuantityChange(quantity - 1)}
          >
            <Minus />
          </Button>
          <span className="text-body w-6 text-center" aria-live="polite">
            {quantity}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Increase quantity"
            onClick={() => onQuantityChange(quantity + 1)}
          >
            <Plus />
          </Button>
        </div>
      )}

      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Remove item"
          onClick={onRemove}
        >
          <X />
        </Button>
      )}
    </div>
  );
}
