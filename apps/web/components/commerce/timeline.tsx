import { Check } from 'lucide-react';
import { formatDateTime } from '@/lib/format-date';
import { cn } from '@/lib/utils';

export interface TimelineStep {
  key: string;
  label: string;
  timestamp?: string;
}

export interface TimelineProps {
  steps: TimelineStep[];
  currentIndex: number;
  /** Ch.10 §43: order status transitions are append-only; a terminal
   * failure (cancelled/failed/refunded) still needs to render, but as a
   * stop, not a step toward "done". */
  failed?: boolean;
}

/** Shared primitive behind OrderTimeline/DeliveryTimeline (Ch.12 §82). */
export function Timeline({ steps, currentIndex, failed = false }: TimelineProps) {
  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, index) => {
        const isComplete = index < currentIndex || (index === currentIndex && !failed);
        const isCurrent = index === currentIndex;
        const isLast = index === steps.length - 1;

        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'text-small flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                  isComplete && !failed && 'border-success bg-success text-success-foreground',
                  isCurrent &&
                    failed &&
                    'border-destructive bg-destructive text-destructive-foreground',
                  !isComplete && !isCurrent && 'border-border bg-background text-muted-foreground',
                )}
                aria-hidden="true"
              >
                {isComplete && !failed ? <Check className="size-3.5" /> : null}
              </span>
              {!isLast && (
                <span
                  className={cn('w-px flex-1', index < currentIndex ? 'bg-success' : 'bg-border')}
                />
              )}
            </div>
            <div className={cn('pb-6', isLast && 'pb-0')}>
              <p
                className={cn(
                  'text-body font-medium',
                  isCurrent ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </p>
              {step.timestamp && (
                <time dateTime={step.timestamp} className="text-caption text-muted-foreground">
                  {formatDateTime(step.timestamp)}
                </time>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
