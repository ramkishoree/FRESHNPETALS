'use client';

import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { ReviewCard } from '@/components/commerce/review-card';
import { Reveal } from '@/components/storefront/reveal';
import { ReviewForm } from '@/components/storefront/review-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface ProductReview {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
  verifiedPurchase: boolean;
  images: string[];
}

/**
 * Owner's explicit call for the revamp: reviews live at the bottom of the
 * product page, revealed as you scroll into them, behind a tab — the
 * product's own reviews first, the shop-wide Google reviews alongside
 * them. Above the fold stays gallery + buy, uninterrupted.
 *
 * `googleReviews` is passed in as already-rendered server markup (the
 * existing GoogleReviewsCarousel) rather than re-fetched here — this
 * component only owns the tab switching.
 */
export function ProductReviews({
  productId,
  reviews,
  googleReviews,
  canModerate = false,
}: {
  productId: string;
  reviews: ProductReview[];
  googleReviews: React.ReactNode;
  /** True only for a signed-in owner/administrator, decided on the
   *  server — the delete control is never rendered for a customer. */
  canModerate?: boolean;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function removeReview(id: string) {
    if (!window.confirm('Remove this review from the site?')) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/v1/admin/reviews/${id}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error?.message ?? 'Could not remove the review.');
      }
      toast.success('Review removed.');
      router.refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not remove the review.');
    } finally {
      setDeletingId(null);
    }
  }

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : null;

  return (
    <Reveal className="mt-20">
      <Tabs defaultValue="product">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="product">Reviews ({reviews.length})</TabsTrigger>
            <TabsTrigger value="google">Google reviews</TabsTrigger>
          </TabsList>

          {averageRating !== null && (
            <div className="flex items-center gap-2">
              <div className="flex" role="img" aria-label={`${averageRating.toFixed(1)} out of 5`}>
                {Array.from({ length: 5 }, (_, index) => (
                  <Star
                    key={index}
                    className={
                      index < Math.round(averageRating)
                        ? 'fill-accent text-accent size-4'
                        : 'text-muted-foreground size-4 fill-none'
                    }
                    aria-hidden="true"
                  />
                ))}
              </div>
              <span className="text-caption text-muted-foreground">
                {averageRating.toFixed(1)} from {reviews.length}{' '}
                {reviews.length === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          )}
        </div>

        <TabsContent value="product">
          <ReviewForm productId={productId} />
          {reviews.length === 0 ? (
            <p className="text-body text-muted-foreground">
              No reviews on this product yet — be the first to leave one.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  authorName={review.authorName}
                  rating={review.rating}
                  comment={review.comment}
                  createdAt={review.createdAt}
                  verifiedPurchase={review.verifiedPurchase}
                  images={review.images}
                  {...(canModerate ? { onDelete: () => void removeReview(review.id) } : {})}
                  isDeleting={deletingId === review.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="google">{googleReviews}</TabsContent>
      </Tabs>
    </Reveal>
  );
}
