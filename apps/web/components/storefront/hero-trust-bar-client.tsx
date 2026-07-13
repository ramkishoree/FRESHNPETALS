'use client';

import * as React from 'react';

interface GoogleReview {
  authorName: string;
  rating: number;
  text: string;
}

const ROTATE_INTERVAL_MS = 4500;
const FADE_MS = 400;

export function HeroTrustBarClient({
  rating,
  ratingCount,
  reviews,
}: {
  rating: number | null;
  ratingCount: number | null;
  reviews: GoogleReview[];
}) {
  const [index, setIndex] = React.useState(0);
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    if (reviews.length <= 1) return;
    const rotate = setInterval(() => {
      setVisible(false);
      const advance = setTimeout(() => {
        setIndex((current) => (current + 1) % reviews.length);
        setVisible(true);
      }, FADE_MS);
      return () => clearTimeout(advance);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(rotate);
  }, [reviews.length]);

  const review = reviews[index % reviews.length];
  if (!review) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
      {rating != null && (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--sf-border)] bg-[var(--sf-surface)] px-3 py-1.5 text-sm font-medium">
          <span className="text-[var(--gold)]">★</span>
          {rating}
          {ratingCount != null && (
            <span className="text-[var(--sf-ink-muted)]">({ratingCount} reviews)</span>
          )}
        </span>
      )}
      <p
        className="text-caption min-w-0 flex-1 truncate text-[var(--sf-ink-muted)] transition-opacity"
        style={{ transitionDuration: `${FADE_MS}ms`, opacity: visible ? 1 : 0 }}
      >
        &ldquo;{review.text}&rdquo; — {review.authorName}
      </p>
    </div>
  );
}
