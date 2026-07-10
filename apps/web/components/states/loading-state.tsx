import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface LoadingStateProps {
  variant?: 'cards' | 'list' | 'table-rows' | 'text';
  count?: number;
  className?: string;
}

/**
 * Ch.12 §81: "Loading state preferred over spinner." This is the default
 * loading UI everywhere in the product — reach for `Spinner` only for a
 * small inline affordance (e.g. inside a submit button) where a skeleton
 * shape doesn't make sense.
 */
export function LoadingState({ variant = 'text', count = 3, className }: LoadingStateProps) {
  if (variant === 'cards') {
    return (
      <div className={cn('grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4', className)}>
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="space-y-3">
            <Skeleton className="rounded-image aspect-square w-full" />
            <Skeleton className="h-4 w-3/4 rounded-md" />
            <Skeleton className="h-4 w-1/3 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2 rounded-md" />
              <Skeleton className="h-3 w-1/4 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table-rows') {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: count }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          key={index}
          className={cn('h-4 rounded-md', index === count - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}
