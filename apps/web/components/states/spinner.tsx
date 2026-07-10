import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SpinnerProps {
  className?: string;
  label?: string;
}

/** Ch.12 §81. Secondary to `LoadingState` — use only for small inline
 * affordances (e.g. inside a submit button) where a skeleton shape doesn't
 * apply; the handbook prefers skeletons everywhere else. */
export function Spinner({ className, label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={cn('size-4 animate-spin', className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
