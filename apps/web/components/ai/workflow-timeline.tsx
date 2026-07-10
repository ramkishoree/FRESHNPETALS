import { Check, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WorkflowStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowStep {
  stepNumber: number;
  label: string;
  status: WorkflowStepStatus;
}

export interface WorkflowTimelineProps {
  steps: WorkflowStep[];
}

const STATUS_STYLES: Record<WorkflowStepStatus, string> = {
  pending: 'border-border bg-background text-muted-foreground',
  running: 'border-info text-info',
  completed: 'border-success bg-success text-success-foreground',
  failed: 'border-destructive bg-destructive text-destructive-foreground',
  skipped: 'border-border bg-muted text-muted-foreground',
};

/**
 * Ch.12 §83. Ch.14 §45/§55: a workflow is an ordered set of steps,
 * checkpointed after every successful one — each step's own status is
 * independent, unlike OrderTimeline's single-current-pointer model.
 */
export function WorkflowTimeline({ steps }: WorkflowTimelineProps) {
  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li key={step.stepNumber} className="flex items-center gap-3">
          <span
            className={cn(
              'text-small flex size-6 shrink-0 items-center justify-center rounded-full border-2',
              STATUS_STYLES[step.status],
            )}
          >
            {step.status === 'completed' && <Check className="size-3.5" aria-hidden="true" />}
            {step.status === 'running' && (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            )}
            {step.status === 'failed' && <X className="size-3.5" aria-hidden="true" />}
          </span>
          <span
            className={cn(
              'text-body',
              step.status === 'pending' || step.status === 'skipped'
                ? 'text-muted-foreground'
                : 'text-foreground',
            )}
          >
            {step.label}
          </span>
          <span className="sr-only">{step.status}</span>
        </li>
      ))}
    </ol>
  );
}
