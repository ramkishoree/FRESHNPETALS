import { cn } from '@/lib/utils';

export interface PriceDisplayProps {
  basePrice: number;
  salePrice?: number | null;
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'text-caption',
  md: 'text-body',
  lg: 'text-h4',
} as const;

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Ch.12 §82 Commerce Component. Ch.9 pricing waterfall computes the real
 * numbers server-side (Ch.9 "All calculations occur server-side") — this
 * component only ever displays whatever it's given, it never calculates a
 * discount itself.
 */
export function PriceDisplay({
  basePrice,
  salePrice,
  currency = 'INR',
  size = 'md',
  className,
}: PriceDisplayProps) {
  const hasDiscount = salePrice != null && salePrice < basePrice;

  return (
    <div className={cn('flex items-baseline gap-2', className)}>
      <span className={cn('text-foreground font-semibold', SIZE_CLASSES[size])}>
        {formatPrice(hasDiscount ? salePrice : basePrice, currency)}
      </span>
      {hasDiscount && (
        <span className="text-caption text-muted-foreground line-through" aria-hidden="true">
          {formatPrice(basePrice, currency)}
        </span>
      )}
      {hasDiscount && (
        <span className="sr-only">{`, reduced from ${formatPrice(basePrice, currency)}`}</span>
      )}
    </div>
  );
}
