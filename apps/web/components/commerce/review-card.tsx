import { Star } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format-date';
import { cn } from '@/lib/utils';

export interface ReviewCardProps {
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
  /** Photos the reviewer uploaded, already re-encoded server-side. */
  images?: string[];
  /** Written from this browser — labels the card and changes what
   *  "Remove" means (withdrawing your own, not moderating someone
   *  else's). */
  isMine?: boolean;
  onEdit?: () => void;
  /** Owner moderation, or the reviewer withdrawing their own. */
  onDelete?: () => void;
  isDeleting?: boolean;
}

/** Ch.12 §82. */
export function ReviewCard({
  authorName,
  rating,
  comment,
  createdAt,
  images = [],
  isMine = false,
  onEdit,
  onDelete,
  isDeleting = false,
}: ReviewCardProps) {
  return (
    <article className="rounded-card border-border space-y-2 border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{authorName}</span>
          {isMine && <Badge variant="outline">Your review</Badge>}
        </div>
        <div className="flex items-center gap-3">
          <time dateTime={createdAt} className="text-caption text-muted-foreground">
            {formatDate(createdAt)}
          </time>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              disabled={isDeleting}
              className="text-caption underline underline-offset-2 disabled:opacity-50"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className="text-caption text-destructive underline underline-offset-2 disabled:opacity-50"
            >
              {isDeleting ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>
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
      {comment && <p className="text-body text-foreground">{comment}</p>}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {images.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer noopener">
              <Image
                src={url}
                alt={`Photo from ${authorName}'s review`}
                width={80}
                height={80}
                className="size-20 rounded-md object-cover"
              />
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
