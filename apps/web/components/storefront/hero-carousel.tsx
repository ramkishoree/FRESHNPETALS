'use client';

import Image from 'next/image';
import * as React from 'react';

export interface HeroSlide {
  id: string;
  slotOrder: number;
  mediaUrl: string;
  captionText: string | null;
}

/** Owner-set: one slide every four seconds. */
const ROTATE_MS = 4000;

/**
 * The homepage hero band.
 *
 * Four admin-managed image slots, rotating on a fixed interval with a
 * crossfade. Slot 1 briefly took video instead; the owner's call is that
 * all four are stills, so nothing here plays. `media_type` stays in the
 * table and the storefront query asks for images explicitly, which means
 * a leftover video row is skipped rather than rendered as a broken
 * picture.
 *
 * Every slide is mounted at once and only opacity changes,
 * so the swap costs no layout and the next image is already decoded
 * when its turn comes — a mount-on-demand carousel flashes the
 * background on a slow connection, which is the one thing a hero must
 * never do.
 *
 * Slots the owner has not filled simply are not in `slides`, and a slide
 * whose media fails to load removes itself from the rotation rather than
 * showing a broken frame. With one slide left there is nothing to rotate
 * to, so the timer never starts.
 *
 * Height is capped in CSS (`.hero-band`), never by the viewport: this is
 * a banner above the catalogue, not a full-screen splash.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [broken, setBroken] = React.useState<ReadonlySet<string>>(() => new Set());
  const [index, setIndex] = React.useState(0);
  const markBroken = React.useCallback((id: string) => {
    setBroken((current) => (current.has(id) ? current : new Set(current).add(id)));
  }, []);

  const usable = React.useMemo(() => slides.filter((s) => !broken.has(s.id)), [slides, broken]);
  const count = usable.length;

  React.useEffect(() => {
    if (count < 2) return;
    // Auto-advance is motion the visitor did not ask for. Anyone who has
    // asked their system for less of it gets the first slide and the
    // dots, and moves through it themselves.
    const stillPreferred = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (stillPreferred.matches) return;

    const timer = setInterval(() => setIndex((current) => (current + 1) % count), ROTATE_MS);
    return () => clearInterval(timer);
  }, [count]);

  // A slide dropping out (or the owner removing one) can leave the
  // pointer past the end of the list.
  const active = count > 0 ? index % count : 0;

  if (count === 0) return null;

  return (
    <section className="hero-band" aria-label="Featured">
      {usable.map((slide, position) => (
        <div
          key={slide.id}
          className={['hero-slide', position === active ? 'is-active' : ''].join(' ')}
          aria-hidden={position !== active}
        >
          <Image
            src={slide.mediaUrl}
            alt={slide.captionText ?? ''}
            fill
            // The band is the page container's content box, not the
            // viewport: it stops growing at 1200px however wide the
            // screen is. `100vw` claimed otherwise, so a 1920px screen at
            // 2x fetched a 3840px-wide file to fill 2400px of it.
            sizes="(min-width: 1360px) 1200px, (min-width: 640px) calc(100vw - 80px), calc(100vw - 40px)"
            // The hero is the largest element above the fold, so the
            // first slide is the page's LCP candidate and must not wait
            // for layout to be discovered.
            priority={position === 0}
            {...(position === 0 ? { fetchPriority: 'high' as const } : {})}
            className="hero-media"
            onError={() => markBroken(slide.id)}
          />

          {slide.captionText && (
            <>
              {/* Only drawn under a caption — a scrim over a picture with
                  no text on it just dulls the picture. */}
              <div className="hero-scrim" aria-hidden />
              <p className="hero-caption">{slide.captionText}</p>
            </>
          )}
        </div>
      ))}

      {count > 1 && (
        <div className="hero-dots">
          {usable.map((slide, position) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setIndex(position)}
              aria-label={`Show slide ${position + 1} of ${count}`}
              aria-current={position === active}
              className={position === active ? 'is-active' : ''}
            />
          ))}
        </div>
      )}
    </section>
  );
}
