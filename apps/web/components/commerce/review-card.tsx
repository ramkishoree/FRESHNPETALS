import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format-date';
import { cn } from '@/lib/utils';

export interface ReviewCardProps {
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
  verifiedPurchase?: boolean;
}

/** Ch.12 §82. Ch.8: "verified-purchase badge". */
export function ReviewCard({
  authorName,
  rating,
  comment,
  createdAt,
  verifiedPurchase,
}: ReviewCardProps) {
  return (
    <article className="rounded-card border-border space-y-2 border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{authorName}</span>
          {verifiedPurchase && (
            <Badge variant="outline" className="text-success-text">
              Verified purchase
            </Badge>
          )}
        </div>
        <time dateTime={createdAt} className="text-caption text-muted-foreground">
          {formatDate(createdAt)}
        </time>
      </div>
      <div className="flex" role="img" aria-label={`${rating} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            className={cn(
              'size-4',
              index < rating ? 'fill-accent text-accent' : 'text-muted-foreground fill-none',
            )}
            aria-hidden="true"
          />
        ))}
      </div>
      <p className="text-body text-foreground">{comment}</p>
    </article>
  );
}
