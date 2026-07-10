'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { LoadingState } from '@/components/states/loading-state';
import { EmptyState } from '@/components/states/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format-date';

interface ReviewRow {
  id: string;
  product_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const STATUS_CLASS: Record<ReviewRow['status'], string> = {
  pending: 'text-warning-text',
  approved: 'text-success-text',
  rejected: 'text-destructive',
};

/** Ch.16 §99 Review Moderation API — approve/reject only; customers create reviews (Phase 9). */
export default function ReviewsPage() {
  const [reviews, setReviews] = React.useState<ReviewRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<'pending' | 'approved' | 'rejected'>(
    'pending',
  );

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/admin/reviews?status=${statusFilter}&limit=50`);
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? 'Failed to load.');
      setReviews(body.data.items as ReviewRow[]);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to load.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => {
    // Standard fetch-on-mount idiom (React docs "Fetching data" pattern);
    // `load`'s own deps gate re-runs, so this doesn't cascade — the
    // compiler's static check can't see that through the async indirection.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function moderate(id: string, status: 'approved' | 'rejected') {
    try {
      const response = await fetch(`/api/v1/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to moderate.');
      toast.success(status === 'approved' ? 'Review approved.' : 'Review rejected.');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to moderate.');
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h2 text-foreground font-bold">Reviews</h1>
        <p className="text-body text-muted-foreground">Customer reviews awaiting moderation.</p>
      </div>

      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected'] as const).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={statusFilter === status ? 'default' : 'outline'}
            onClick={() => setStatusFilter(status)}
          >
            {status[0]?.toUpperCase()}
            {status.slice(1)}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState variant="list" count={4} />
      ) : reviews.length === 0 ? (
        <EmptyState title="No reviews" description={`No ${statusFilter} reviews right now.`} />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-card border-border space-y-2 border p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-medium">
                    {review.title ?? 'Untitled review'}
                  </span>
                  <Badge variant="outline" className={STATUS_CLASS[review.status]}>
                    {review.status}
                  </Badge>
                </div>
                <span className="text-caption text-muted-foreground">
                  {formatDate(review.created_at)}
                </span>
              </div>
              <p className="text-body text-foreground">{review.comment}</p>
              <p className="text-caption text-muted-foreground">Rating: {review.rating} / 5</p>
              {review.status === 'pending' && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => moderate(review.id, 'approved')}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => moderate(review.id, 'rejected')}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
