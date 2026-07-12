'use client';

import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';

const DISMISSED_KEY_PREFIX = 'fp-announcement-dismissed-';

export function AnnouncementBannerClient({
  id,
  title,
  message,
  imageUrl,
  offerName,
}: {
  id: string;
  title: string | null;
  message: string;
  imageUrl: string | null;
  offerName: string | null;
}) {
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
    <div className="border-border bg-muted/40 flex items-center gap-4 border-b px-4 py-3">
      {imageUrl && (
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
          <Image src={imageUrl} alt="" fill className="object-cover" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        {title && <p className="text-body text-foreground font-semibold">{title}</p>}
        <p className="text-caption text-muted-foreground truncate">{message}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/shop"
          className="rounded-button bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium"
        >
          {offerName ? `Shop ${offerName}` : 'Shop now'}
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground px-2 py-1.5 text-sm"
        >
          No thanks
        </button>
      </div>
    </div>
  );
}
