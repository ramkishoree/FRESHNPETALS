import { Check, Loader2 } from 'lucide-react';
import type { AutosaveStatus } from '@/hooks/use-autosave';
import { cn } from '@/lib/utils';

export interface FormAutosaveIndicatorProps {
  status: AutosaveStatus;
  className?: string;
}

const COPY: Record<AutosaveStatus, string> = {
  idle: '',
  dirty: 'Unsaved changes',
  saving: 'Saving...',
  saved: 'Saved',
  error: "Couldn't save — check your connection and try again.",
};

/** Ch.12 §85 dirty-state indicator, paired with `useAutosave`. */
export function FormAutosaveIndicator({ status, className }: FormAutosaveIndicatorProps) {
  if (status === 'idle') return null;

  return (
    <p
      role="status"
      className={cn(
        'text-caption flex items-center gap-1.5',
        status === 'error' ? 'text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      {status === 'saving' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
      {status === 'saved' && <Check className="text-success-text size-3.5" aria-hidden="true" />}
      {COPY[status]}
    </p>
  );
}
