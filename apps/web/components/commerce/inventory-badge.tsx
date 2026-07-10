import { Badge } from '@/components/ui/badge';

export interface InventoryBadgeProps {
  availableQuantity: number;
  lowStockThreshold: number;
  criticalThreshold?: number;
}

/**
 * Ch.12 §82. Thresholds mirror infrastructure/database/migrations/0005
 * (inventory.low_stock_threshold/critical_threshold) and
 * mv_inventory_dashboard's stock_status derivation (Phase 3) — kept
 * consistent rather than inventing a different rule client-side.
 */
export function InventoryBadge({
  availableQuantity,
  lowStockThreshold,
  criticalThreshold = 1,
}: InventoryBadgeProps) {
  if (availableQuantity <= 0) {
    return <Badge className="bg-destructive text-destructive-foreground">Out of stock</Badge>;
  }
  if (availableQuantity <= criticalThreshold) {
    return (
      <Badge className="bg-warning text-warning-foreground">{`Only ${availableQuantity} left`}</Badge>
    );
  }
  if (availableQuantity <= lowStockThreshold) {
    return (
      <Badge variant="outline" className="text-warning-text">
        Low stock
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-success-text">
      In stock
    </Badge>
  );
}
