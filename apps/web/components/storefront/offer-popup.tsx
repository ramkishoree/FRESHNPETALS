'use client';

import Link from 'next/link';
import * as React from 'react';

const DISMISSED_KEY_PREFIX = 'fp-offer-popup-seen-';

/**
 * Owner's explicit call: a real popup (not just the thin announcement
 * banner) so the day's offer commands attention in the first couple of
 * swipes. Session-scoped (sessionStorage, not localStorage) — reappears
 * on a fresh visit rather than being dismissed for good the first time,
 * since the offer itself may have changed since the visitor's last visit.
 */
export function OfferPopup({
  offerId,
  title,
  description,
}: {
  offerId: string;
  title: string;
  description: string;
}) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const key = DISMISSED_KEY_PREFIX + offerId;
    const alreadySeen = window.sessionStorage.getItem(key) === '1';
    if (alreadySeen) return;
    const timer = setTimeout(() => {
      window.sessionStorage.setItem(key, '1');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- delayed reveal, not render-time state
      setOpen(true);
    }, 900);
    return () => clearTimeout(timer);
  }, [offerId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="relative w-full max-w-sm rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-7 text-center shadow-[var(--shadow-lift)]">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground absolute right-3 top-3 grid size-8 place-items-center rounded-full"
        >
          ✕
        </button>
        <p className="eyebrow mb-3">Today&rsquo;s offer</p>
        <p className="text-h3 mb-2">{title}</p>
        {description && <p className="text-body text-[var(--sf-ink-muted)]">{description}</p>}
        <Link
          href="/shop"
          onClick={() => setOpen(false)}
          className="btn btn-primary mt-6 inline-flex items-center px-7 py-3 text-sm"
        >
          Shop now
        </Link>
      </div>
    </div>
  );
}
