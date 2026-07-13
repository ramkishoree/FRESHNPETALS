'use client';

import * as React from 'react';

/**
 * One-shot scroll-triggered fade-in, using the `.reveal`/`.reveal.is-in`
 * CSS already defined in storefront-theme.css (previously written but
 * never wired up to any component). A single IntersectionObserver per
 * wrapped section flips one class and disconnects — no per-scroll-frame
 * work, no observer left running once a section has revealed itself.
 * `prefers-reduced-motion` is handled entirely in that CSS, not here, so
 * this always renders the same markup either way.
 *
 * A hard 1.5s fallback timer forces `visible` regardless of the observer
 * — a search crawler (or any client that never fires a scroll/resize
 * event) would otherwise leave this content sitting at opacity:0
 * forever, which is a real SEO/reliability risk for a page whose whole
 * point is to be indexed and read, not just an animation nice-to-have.
 */
export function Reveal({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px 100px 0px' },
    );
    observer.observe(el);
    const fallback = setTimeout(() => setVisible(true), 1500);
    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  return (
    <div className={`reveal ${visible ? 'is-in' : ''} ${className}`.trim()} ref={ref}>
      {children}
    </div>
  );
}
