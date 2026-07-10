import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ConfidenceBadgeProps {
  score: number;
  className?: string;
}

/** Ch.14 §36: "Scores 0-100. Confidence does not replace human approval" —
 * this badge is informational only, never a gate; the Approval Queue is. */
export function ConfidenceBadge({ score, className }: ConfidenceBadgeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const tier = clamped >= 80 ? 'high' : clamped >= 50 ? 'medium' : 'low';

  return (
    <Badge
      variant="outline"
      className={cn(
        tier === 'high' && 'text-success-text',
        tier === 'medium' && 'text-warning-text',
        tier === 'low' && 'text-destructive',
        className,
      )}
    >
      {`${clamped}% confidence`}
    </Badge>
  );
}
