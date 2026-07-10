import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Ch.12 §81 Feedback Component. Ch.5.25: "Human language. Never technical
 * jargon" — never render a raw error message, HTTP status, or stack trace
 * here; the default copy is the handbook's own example, verbatim.
 */
export function ErrorState({
  title = 'Something went wrong',
  message = "We couldn't complete your request. Please try again in a moment.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-card border-border flex flex-col items-center justify-center gap-3 border px-6 py-16 text-center',
        className,
      )}
    >
      <AlertTriangle className="text-destructive size-10" aria-hidden="true" />
      <p className="text-h4 text-foreground font-semibold">{title}</p>
      <p className="text-body text-muted-foreground max-w-sm">{message}</p>
      {onRetry && (
        <Button type="button" variant="outline" onClick={onRetry} className="mt-2">
          Try again
        </Button>
      )}
    </div>
  );
}
