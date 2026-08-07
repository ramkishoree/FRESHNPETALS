import { Check, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CouponCardProps {
  code: string;
  description: string;
  applied?: boolean;
  onApply?: () => void;
  onRemove?: () => void;
  className?: string;
}

/** Ch.12 §82. Actual validation always happens server-side (Ch.8 §8.11) —
 * this component only reflects whatever state the caller passes in. */
export function CouponCard({
  code,
  description,
  applied,
  onApply,
  onRemove,
  className,
}: CouponCardProps) {
  return (
    <div
      className={cn(
        'rounded-card border-border flex items-center justify-between gap-3 border border-dashed p-4',
        applied && 'border-success bg-success/5 border-solid',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Ticket
          className={cn('size-5', applied ? 'text-success-text' : 'text-muted-foreground')}
          aria-hidden="true"
        />
        <div>
          <p className="text-body font-mono font-semibold tracking-wide uppercase">{code}</p>
          <p className="text-caption text-muted-foreground">{description}</p>
        </div>
      </div>
      {applied ? (
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Check className="text-success-text" aria-hidden="true" />
          Applied
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={onApply}>
          Apply
        </Button>
      )}
    </div>
  );
}
