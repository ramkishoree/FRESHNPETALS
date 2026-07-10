import { Badge } from '@/components/ui/badge';

export interface DiscountBadgeProps {
  basePrice: number;
  salePrice?: number | null;
}

/** Ch.12 §82. Renders nothing when there's no real discount to show —
 * an empty/zero badge is worse than no badge. */
export function DiscountBadge({ basePrice, salePrice }: DiscountBadgeProps) {
  if (salePrice == null || salePrice >= basePrice || basePrice <= 0) return null;

  const percentOff = Math.round(((basePrice - salePrice) / basePrice) * 100);
  if (percentOff <= 0) return null;

  return (
    <Badge className="bg-success text-success-foreground hover:bg-success">{`${percentOff}% OFF`}</Badge>
  );
}
