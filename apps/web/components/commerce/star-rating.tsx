import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Five stars, filled to the nearest whole one.
 *
 * The owner's call: no half stars. A 4.4 average and a 4.6 average both
 * mean "about four or five", and a half-filled star reads as precision
 * the sample size rarely earns — six reviews cannot really tell 4.4 from
 * 4.6 apart. The exact figure is still printed beside the stars wherever
 * there is room for it.
 */
export function StarRating({
  rating,
  count,
  size = 'md',
  showValue = true,
  className,
}: {
  rating: number;
  /** Number of reviews behind the average. Hidden when omitted. */
  count?: number;
  size?: 'sm' | 'md';
  showValue?: boolean;
  className?: string;
}) {
  const filled = Math.round(rating);
  const starClass = size === 'sm' ? 'size-3.5' : 'size-4';

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div
        className="flex"
        role="img"
        aria-label={
          count === undefined
            ? `${rating.toFixed(1)} out of 5`
            : `${rating.toFixed(1)} out of 5 from ${count} ${count === 1 ? 'review' : 'reviews'}`
        }
      >
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            className={cn(
              starClass,
              index < filled ? 'fill-accent text-accent' : 'text-muted-foreground fill-none',
            )}
            aria-hidden="true"
          />
        ))}
      </div>
      {/* aria-hidden: the stars above already announce all of this, and a
          screen reader repeating "4.5 (6)" straight after is noise. */}
      <span className="text-caption text-muted-foreground" aria-hidden="true">
        {showValue && rating.toFixed(1)}
        {count !== undefined && (showValue ? ` (${count})` : `${count}`)}
      </span>
    </div>
  );
}
