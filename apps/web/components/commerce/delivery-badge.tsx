import { Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface DeliveryBadgeProps {
  sameDayAvailable?: boolean;
  estimatedLabel?: string;
  className?: string;
}

/** Ch.12 §82. Ch.8 §8.8: same-day eligibility depends on outlet/delivery-
 * group resolution done server-side — this only renders whatever the
 * caller already resolved. */
export function DeliveryBadge({ sameDayAvailable, estimatedLabel, className }: DeliveryBadgeProps) {
  const label = sameDayAvailable ? 'Same-day delivery' : (estimatedLabel ?? 'Delivery available');

  return (
    <Badge variant="outline" className={cn('text-info-text gap-1', className)}>
      <Truck className="size-3.5" aria-hidden="true" />
      {label}
    </Badge>
  );
}
