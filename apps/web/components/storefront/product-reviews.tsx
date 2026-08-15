'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { ReviewCard } from '@/components/commerce/review-card';
import { StarRating } from '@/components/commerce/star-rating';
import { Reveal } from '@/components/storefront/reveal';
import { ReviewEditor } from '@/components/storefront/review-editor';
import { ReviewForm } from '@/components/storefront/review-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { forgetReviewToken, getReviewToken, useOwnedReviewIds } from '@/lib/my-reviews';

export interface ProductReview {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
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
  const [editingId, setEditingId] = React.useState<string | null>(null);
  /**
   * Which of these reviews this browser can edit. Subscribed rather than
   * read once on mount: posting a review refreshes server data without
   * remounting, and the reviewer should see their own Edit and Remove
   * controls straight away rather than after a manual reload.
   */
  const ownedIds = useOwnedReviewIds();

  /** The reviewer withdrawing their own review, not the owner removing it. */
  async function withdrawReview(id: string) {
    const token = getReviewToken(id);
    if (!token) return;
    if (!window.confirm('Remove your review from this product?')) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/v1/products/${productId}/reviews/${id}`, {
        method: 'DELETE',
        headers: { 'x-review-token': token },
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error?.message ?? 'Could not remove your review.');
      }
      forgetReviewToken(id);
      toast.success('Your review has been removed.');
      router.refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not remove your review.');
    } finally {
      setDeletingId(null);
    }
  }

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

          {averageRating !== null && <StarRating rating={averageRating} count={reviews.length} />}
        </div>

        <TabsContent value="product">
          <ReviewForm productId={productId} />
          {reviews.length === 0 ? (
            <p className="text-body text-muted-foreground">
              No reviews on this product yet — be the first to leave one.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {reviews.map((review) => {
                const token = ownedIds.includes(review.id) ? getReviewToken(review.id) : null;

                if (editingId === review.id && token) {
                  return (
                    <ReviewEditor
                      key={review.id}
                      productId={productId}
                      reviewId={review.id}
                      token={token}
                      initialRating={review.rating}
                      initialComment={review.comment}
                      initialImages={review.images}
                      onDone={() => {
                        setEditingId(null);
                        router.refresh();
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  );
                }

                return (
                  <ReviewCard
                    key={review.id}
                    authorName={review.authorName}
                    rating={review.rating}
                    comment={review.comment}
                    createdAt={review.createdAt}
                    images={review.images}
                    isMine={token !== null}
                    {...(token ? { onEdit: () => setEditingId(review.id) } : {})}
                    {...(token
                      ? { onDelete: () => void withdrawReview(review.id) }
                      : canModerate
                        ? { onDelete: () => void removeReview(review.id) }
                        : {})}
                    isDeleting={deletingId === review.id}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="google">{googleReviews}</TabsContent>
      </Tabs>
    </Reveal>
  );
}
