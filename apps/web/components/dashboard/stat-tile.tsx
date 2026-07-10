import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatTileProps {
  label: string;
  value: string;
  trend?: { direction: 'up' | 'down'; label: string; isPositive?: boolean };
  className?: string;
}

/**
 * Ch.12 §5.44/§92: Dashboard Homepage widget — revenue/orders/deliveries/
 * low-inventory counts. `trend.isPositive` is separate from `direction`
 * because "down" isn't always bad (e.g. a falling refund rate is good).
 */
export function StatTile({ label, value, trend, className }: StatTileProps) {
  const isGood = trend?.isPositive ?? trend?.direction === 'up';

  return (
    <Card className={cn('rounded-card', className)}>
      <CardContent className="space-y-1 pt-6">
        <p className="text-caption text-muted-foreground">{label}</p>
        <p className="text-hero text-foreground font-bold">{value}</p>
        {trend && (
          <p
            className={cn(
              'text-caption flex items-center gap-1',
              isGood ? 'text-success-text' : 'text-destructive',
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="size-3.5" aria-hidden="true" />
            ) : (
              <TrendingDown className="size-3.5" aria-hidden="true" />
            )}
            {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
