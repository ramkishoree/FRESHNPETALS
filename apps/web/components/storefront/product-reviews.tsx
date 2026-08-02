'use client';

import { Star } from 'lucide-react';
import * as React from 'react';
import { ReviewCard } from '@/components/commerce/review-card';
import { Reveal } from '@/components/storefront/reveal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface ProductReview {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
  verifiedPurchase: boolean;
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
  reviews,
  googleReviews,
}: {
  reviews: ProductReview[];
  googleReviews: React.ReactNode;
}) {
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
          {reviews.length === 0 ? (
            <p className="text-body text-muted-foreground">
              No reviews on this product yet — order it and you&apos;ll be asked for one after
              delivery.
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
