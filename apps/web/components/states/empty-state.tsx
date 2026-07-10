import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * Ch.12 §81 Feedback Component; Ch.5.23: "Illustration. Helpful message.
 * Primary CTA. Never blank pages." Copy stays plain and active-voice — an
 * empty screen is an invitation to act, not an apology.
 */
export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-card border-border flex flex-col items-center justify-center gap-3 border border-dashed px-6 py-16 text-center',
        className,
      )}
    >
      <div className="text-muted-foreground">
        {icon ?? <Inbox className="size-10" aria-hidden="true" />}
      </div>
      <p className="text-h4 text-foreground font-semibold">{title}</p>
      {description && <p className="text-body text-muted-foreground max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button type="button" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
