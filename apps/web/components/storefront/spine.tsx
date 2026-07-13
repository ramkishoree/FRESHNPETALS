'use client';

import { usePathname } from 'next/navigation';
import * as React from 'react';

/**
 * The "living stem" signature motif from the owner's reference design —
 * a gold botanical line that draws itself downward as the page scrolls,
 * leaves greening and flowers blooming as it passes them. Perf: ONE
 * passive rAF-throttled scroll listener writes ONE CSS var (--grow) on
 * this element; every leaf/flower derives its own state from --grow in
 * pure CSS (see .stem-line/.leaf/.bloom in storefront-theme.css) — no
 * per-frame React state, no re-render.
 *
 * Owner's explicit call: the scroll-driven grow-in animation is a
 * homepage-only moment. Every other storefront page shows the stem
 * fully bloomed and static — no listener, no motion — so it reads as
 * a fixed decorative mark rather than something that looks broken or
 * stuck mid-animation on a short page.
 */
export function Spine() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const ref = React.useRef<HTMLDivElement>(null);
  const pathRef = React.useRef<SVGPathElement>(null);

  React.useEffect(() => {
    const pathEl = pathRef.current;
    if (!pathEl) return;
    // Measured once from the actual rendered path — under this SVG's
    // non-uniform scale (preserveAspectRatio="none"), a hardcoded
    // dasharray value fights the coordinate remapping and the reveal
    // silently renders invisible instead of drawing the line. The real
    // length (close to but not exactly the 3000 viewBox height, since
    // the zigzag curve has real arc length beyond pure vertical
    // distance) sidesteps that entirely.
    const length = pathEl.getTotalLength();
    pathEl.style.strokeDasharray = `${length}`;

    if (!isHome) {
      pathEl.style.strokeDashoffset = '0';
      return;
    }

    const el = ref.current;
    if (!el) return;
    let ticking = false;

    function update() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const g = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      const grow = g * 0.92 + 0.08;
      el?.style.setProperty('--grow', grow.toFixed(4));
      if (pathEl) pathEl.style.strokeDashoffset = `${length * (1 - grow)}`;
      ticking = false;
    }
    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [isHome]);

  return (
    <div
      className="spine"
      aria-hidden="true"
      ref={ref}
      style={isHome ? undefined : ({ '--grow': 1 } as React.CSSProperties)}
    >
      <svg viewBox="0 0 90 3000" fill="none" preserveAspectRatio="none">
        <path
          ref={pathRef}
          className="stem-line"
          d="M45 0 C45 200 20 340 45 520 C70 700 20 880 45 1080 C70 1280 22 1450 45 1650 C68 1850 24 2020 45 2220 C66 2420 30 2600 45 2800 C52 2900 45 2950 45 3000"
        />
        <path
          className="leaf"
          style={{ '--at': 0.061 } as React.CSSProperties}
          d="M45 304 C17 296 2 316 11 342 C37 338 47 323 45 304Z"
        />
        <path
          className="leaf leaf-r"
          style={{ '--at': 0.123 } as React.CSSProperties}
          d="M42 488 C70 480 86 500 78 526 C52 523 40 508 42 488Z"
        />
        <path
          className="leaf"
          style={{ '--at': 0.184 } as React.CSSProperties}
          d="M45 672 C17 664 2 684 11 710 C37 706 47 691 45 672Z"
        />
        <path
          className="leaf leaf-r"
          style={{ '--at': 0.245 } as React.CSSProperties}
          d="M42 856 C70 848 86 868 78 894 C52 891 40 876 42 856Z"
        />
        <path
          className="leaf"
          style={{ '--at': 0.307 } as React.CSSProperties}
          d="M45 1040 C17 1032 2 1052 11 1078 C37 1074 47 1059 45 1040Z"
        />
        <path
          className="leaf leaf-r"
          style={{ '--at': 0.368 } as React.CSSProperties}
          d="M42 1224 C70 1216 86 1236 78 1262 C52 1259 40 1244 42 1224Z"
        />
        <path
          className="leaf"
          style={{ '--at': 0.429 } as React.CSSProperties}
          d="M45 1408 C17 1400 2 1420 11 1446 C37 1442 47 1427 45 1408Z"
        />
        <path
          className="leaf leaf-r"
          style={{ '--at': 0.491 } as React.CSSProperties}
          d="M42 1592 C70 1584 86 1604 78 1630 C52 1627 40 1612 42 1592Z"
        />
        <path
          className="leaf"
          style={{ '--at': 0.552 } as React.CSSProperties}
          d="M45 1776 C17 1768 2 1788 11 1814 C37 1810 47 1795 45 1776Z"
        />
        <path
          className="leaf leaf-r"
          style={{ '--at': 0.613 } as React.CSSProperties}
          d="M42 1960 C70 1952 86 1972 78 1998 C52 1995 40 1980 42 1960Z"
        />
        <path
          className="leaf"
          style={{ '--at': 0.675 } as React.CSSProperties}
          d="M45 2144 C17 2136 2 2156 11 2182 C37 2178 47 2163 45 2144Z"
        />
        <path
          className="leaf leaf-r"
          style={{ '--at': 0.736 } as React.CSSProperties}
          d="M42 2328 C70 2320 86 2340 78 2366 C52 2363 40 2348 42 2328Z"
        />
        <path
          className="leaf"
          style={{ '--at': 0.797 } as React.CSSProperties}
          d="M45 2512 C17 2504 2 2524 11 2550 C37 2546 47 2531 45 2512Z"
        />
        <path
          className="leaf leaf-r"
          style={{ '--at': 0.859 } as React.CSSProperties}
          d="M42 2696 C70 2688 86 2708 78 2734 C52 2731 40 2716 42 2696Z"
        />
        {(
          [
            [0.077, 331, 'lg'],
            [0.206, 734, 'sm'],
            [0.334, 1137, 'lg'],
            [0.463, 1540, 'sm'],
            [0.591, 1943, 'lg'],
            [0.72, 2346, 'sm'],
            [0.849, 2748, 'lg'],
          ] as const
        ).map(([at, y, size]) => (
          <g
            key={y}
            className="bloom"
            style={{ '--at': at } as React.CSSProperties}
            transform={`translate(45,${y})`}
          >
            {size === 'lg' ? (
              <>
                <path
                  className="bloom-petal"
                  d="M0-13 C9-13 13-6 13 0 C13 8 9 13 0 13 C-9 13 -13 8 -13 0 C-13-6 -9-13 0-13Z"
                  opacity={0.92}
                />
                <path
                  className="bloom-petal"
                  d="M0-13 C9-13 13-6 13 0 C13 8 9 13 0 13 C-9 13 -13 8 -13 0 C-13-6 -9-13 0-13Z"
                  transform="rotate(45)"
                  opacity={0.92}
                />
                <circle className="bloom-core" r={4} />
              </>
            ) : (
              <>
                <path
                  className="bloom-petal"
                  d="M0-11 C8-11 11-5 11 0 C11 7 8 11 0 11 C-8 11 -11 7 -11 0 C-11-5 -8-11 0-11Z"
                  opacity={0.92}
                />
                <path
                  className="bloom-petal"
                  d="M0-11 C8-11 11-5 11 0 C11 7 8 11 0 11 C-8 11 -11 7 -11 0 C-11-5 -8-11 0-11Z"
                  transform="rotate(45)"
                  opacity={0.92}
                />
                <circle className="bloom-core" r={3} />
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
