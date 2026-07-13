'use client';

import { usePathname } from 'next/navigation';
import * as React from 'react';

/**
 * Fire-and-forget first-party page-view beacon for the admin traffic
 * dashboard. Storefront-only — never mounted in the admin layout, since
 * the dashboard reads this data, it doesn't generate it from its own
 * page loads (the "no analytics in the admin panel" rule is about not
 * tracking admin *usage*, not about the dashboard showing store
 * traffic, which the owner explicitly asked for).
 */
export function PageViewTracker() {
  const pathname = usePathname();

  React.useEffect(() => {
    if (!pathname) return;
    const body = JSON.stringify({ path: pathname });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/v1/track', new Blob([body], { type: 'application/json' }));
    } else {
      void fetch('/api/v1/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
    }
  }, [pathname]);

  return null;
}
