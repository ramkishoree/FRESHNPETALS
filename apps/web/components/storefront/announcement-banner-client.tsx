'use client';

import { X } from 'lucide-react';
import * as React from 'react';

const DISMISSED_KEY_PREFIX = 'fp-announcement-dismissed-';

/**
 * A sentence on a green strip. That is the whole feature.
 *
 * It used to carry a title, an image, an offer button and a dismiss
 * button. The owner's call was blunt and correct: "no need for button
 * and all, no image and all, only green background white text". Colour
 * and layout are fixed here rather than configured in the admin, so
 * there is nothing to set up wrong — the admin asks for the sentence and
 * nothing else.
 *
 * The dismiss control stays. A banner you cannot get rid of follows you
 * down every page of the site.
 */
export function AnnouncementBannerClient({ id, message }: { id: string; message: string }) {
  const [dismissed, setDismissed] = React.useState(true);

  React.useEffect(() => {
    // Reads localStorage, so this can only run client-side after mount —
    // starting `dismissed` true and flipping it here (rather than reading
    // localStorage during render) avoids a server/client hydration
    // mismatch, at the cost of a one-frame flash-in for visitors who
    // haven't dismissed it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(window.localStorage.getItem(DISMISSED_KEY_PREFIX + id) === '1');
  }, [id]);

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY_PREFIX + id, '1');
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className="bg-[var(--fp-green)] text-white">
      <div className="container-brand flex items-center justify-center gap-3 py-2.5">
        <p className="text-center text-sm font-medium">{message}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="shrink-0 rounded-full p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
