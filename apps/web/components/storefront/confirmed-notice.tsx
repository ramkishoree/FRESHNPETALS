'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { BrandDivider } from '@/components/storefront/brand-divider';
import { safeNextPath } from '@/lib/safe-next-path';

const COUNTDOWN_SECONDS = 5;

/**
 * Counts down, then tries to close the tab.
 *
 * `window.close()` only works on a window opened by script — a tab the
 * mail app opened will refuse, silently. So closing is attempted and, a
 * beat later, the page continues to the destination instead. Either way
 * nobody is left staring at a dead-end tab, which is the actual
 * requirement; whether it literally closes is the browser's call, not
 * ours.
 */
export function ConfirmedNotice() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'), '/account');
  const [secondsLeft, setSecondsLeft] = React.useState(COUNTDOWN_SECONDS);

  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  React.useEffect(() => {
    if (secondsLeft > 0) return;
    window.close();
    // Still here means the browser refused to close a tab it didn't open.
    const fallback = window.setTimeout(() => router.replace(next), 250);
    return () => window.clearTimeout(fallback);
  }, [secondsLeft, next, router]);

  return (
    <div className="container-brand grid min-h-[70vh] place-items-center py-16 text-center">
      <div className="max-w-md">
        <div
          className="mx-auto grid size-14 place-items-center rounded-full border-2 border-[var(--gold)]"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor">
            <path
              d="M5 13l4 4L19 7"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="eyebrow mt-8">Sign-in confirmed</p>
        <h1 className="text-h2 mt-3">You&rsquo;re signed in</h1>
        <p className="text-body-lg mt-3" aria-live="polite">
          {secondsLeft > 0
            ? `Closing this tab in ${secondsLeft} second${secondsLeft === 1 ? '' : 's'}…`
            : 'Closing this tab…'}
        </p>
        <p className="text-caption text-muted-foreground mt-4">
          You can go back to the tab where you started — it signs you in on its own.
        </p>
        <button
          type="button"
          onClick={() => router.replace(next)}
          className="bg-foreground text-background mt-8 rounded-full px-6 py-3 text-sm font-medium"
        >
          Continue here instead
        </button>
        <BrandDivider className="my-8" />
      </div>
    </div>
  );
}
