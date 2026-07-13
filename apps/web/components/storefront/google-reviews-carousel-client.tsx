'use client';

import * as React from 'react';
import { BrandDivider } from './brand-divider';

interface GoogleReview {
  authorName: string;
  rating: number;
  text: string;
  relativeTime: string;
  profilePhotoUrl: string | null;
}

const ROTATE_INTERVAL_MS = 5000;

function StarRating({ rating }: { rating: number }) {
  return (
    <div
      aria-label={`${rating} out of 5 stars`}
      className="text-lg leading-none text-[var(--gold)]"
    >
      {'★'.repeat(Math.round(rating))}
      <span className="text-muted-foreground">{'★'.repeat(5 - Math.round(rating))}</span>
    </div>
  );
}

export function GoogleReviewsCarouselClient({
  businessName,
  rating,
  ratingCount,
  reviews,
}: {
  businessName: string | null;
  rating: number | null;
  ratingCount: number | null;
  reviews: GoogleReview[];
}) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (reviews.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % reviews.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [reviews.length]);

  const review = reviews[index % reviews.length];
  if (!review) return null;

  return (
    <section className="mt-20 text-center">
      <p className="eyebrow mb-2">Loved by locals</p>
      <h2 className="text-h3">
        {businessName ? `Reviews for ${businessName}` : 'Customer reviews'}
        {rating != null && (
          <span className="text-muted-foreground text-base font-normal">
            {' '}
            — {rating}★ on Google{ratingCount != null ? ` (${ratingCount} reviews)` : ''}
          </span>
        )}
      </h2>
      <BrandDivider className="my-6" />
      <div key={index} className="review-fade mx-auto max-w-2xl space-y-3 text-left">
        <div className="flex items-center gap-3">
          {review.profilePhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- Google-hosted avatar, not a storefront asset next/image should optimize
            <img
              src={review.profilePhotoUrl}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          )}
          <div>
            <p className="text-body text-foreground font-medium">{review.authorName}</p>
            <p className="text-caption text-muted-foreground">{review.relativeTime}</p>
          </div>
        </div>
        <StarRating rating={review.rating} />
        <p className="text-body-lg">{review.text}</p>
      </div>
      {reviews.length > 1 && (
        <div className="mt-4 flex justify-center gap-1.5">
          {reviews.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show review ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === index ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
