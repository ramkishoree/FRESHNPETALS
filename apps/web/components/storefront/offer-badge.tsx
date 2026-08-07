'use client';

import { X } from 'lucide-react';
import * as React from 'react';

export interface OfferBadgeOffer {
  id: string;
  tagline: string;
  bannerHeading: string | null;
  couponCode: string | null;
  conditionsText: string | null;
  endsAt: string | null;
}

const SEEN_KEY_PREFIX = 'fp-offer-poster-seen-';

function formatEnds(endsAt: string | null): string | null {
  if (!endsAt) return null;
  return new Date(endsAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
  });
}

/**
 * A small round badge pinned to the corner of the storefront, and the
 * poster it opens.
 *
 * The owner's design: green circle, gold ring, the offer in a few words.
 * Tapping it opens the full poster — heading, coupon code, when it ends,
 * and the conditions written in plain words.
 *
 * The poster shows itself once per session rather than on every page
 * load: an offer worth announcing is worth interrupting for once, not
 * repeatedly. After that the badge stays put, so the offer is always one
 * tap away without ever being in the way.
 */
export function OfferBadge({ offer }: { offer: OfferBadgeOffer }) {
  const [open, setOpen] = React.useState(false);
  const endsLabel = formatEnds(offer.endsAt);

  React.useEffect(() => {
    const key = SEEN_KEY_PREFIX + offer.id;
    if (window.sessionStorage.getItem(key) === '1') return;
    const timer = window.setTimeout(() => {
      window.sessionStorage.setItem(key, '1');
      setOpen(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [offer.id]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Offer: ${offer.tagline}`}
        className="fixed bottom-5 left-5 z-40 grid size-20 place-items-center rounded-full border-2 border-[var(--gold)] bg-[var(--fp-green)] p-2 text-center text-[11px] leading-tight font-semibold text-white shadow-lg transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:outline-none"
      >
        <span className="line-clamp-3">{offer.tagline}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={offer.tagline}
          onClick={() => setOpen(false)}
        >
          <div
            className="rounded-card relative w-full max-w-sm overflow-hidden bg-[var(--fp-green)] text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close offer"
              className="absolute top-3 right-3 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              <X className="size-4" aria-hidden="true" />
            </button>

            <div className="px-6 pt-8 pb-6 text-center">
              {/* The mark, as a circular ivory badge — the brand's own
                  gold-on-ivory, so the poster reads as Fresh & Petals
                  rather than a generic discount pop-up. */}
              <span className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-[var(--fp-ivory)]">
                <span className="text-lg font-bold text-[var(--gold-deep)]">F&amp;P</span>
              </span>

              {offer.bannerHeading && (
                <p className="mb-1 text-xs tracking-[0.18em] text-white/70 uppercase">
                  {offer.bannerHeading}
                </p>
              )}
              <h2 className="text-2xl leading-snug font-bold">{offer.tagline}</h2>

              {offer.couponCode && (
                <div className="mt-5">
                  <p className="text-xs tracking-wide text-white/70 uppercase">Use code</p>
                  <p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-[var(--gold)]">
                    {offer.couponCode}
                  </p>
                </div>
              )}

              {endsLabel && <p className="mt-4 text-sm text-white/80">Ends {endsLabel}</p>}

              {offer.conditionsText && (
                <p className="mt-5 border-t border-white/20 pt-4 text-left text-xs leading-relaxed whitespace-pre-line text-white/75">
                  {offer.conditionsText}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
