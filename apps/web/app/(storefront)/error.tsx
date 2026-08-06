'use client';

import Link from 'next/link';
import * as React from 'react';
import { BrandDivider } from '@/components/storefront/brand-divider';

/**
 * Without this file, anything thrown in a storefront server component
 * fell through to Next's built-in error screen — "This page couldn't
 * load", no branding, no way forward but the browser's back button. A
 * customer hit it straight after a successful COD order: the order was
 * placed, the confirmation page threw on a stale session, and the last
 * thing they saw suggested the whole thing had failed.
 *
 * The reassurance about orders is the important part. Someone landing
 * here mid-checkout needs to know not to pay twice.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Surfaces in the browser console and in Vercel's client telemetry;
    // `digest` is the only handle back to the server-side stack.
    console.error('storefront.error', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="container-brand grid min-h-[70vh] place-items-center py-16 text-center">
      <div className="max-w-md">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="text-h2 mt-3">This page didn&rsquo;t load</h1>
        <p className="text-body-lg mt-3">
          Sorry — that&rsquo;s on us, not you. Trying again usually works.
        </p>
        <p className="text-caption text-muted-foreground mt-4">
          If you were paying for an order, check{' '}
          <Link
            href="/account/orders"
            className="text-[var(--gold-deep)] underline underline-offset-2"
          >
            My Orders
          </Link>{' '}
          before paying again — it may already be placed.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="bg-foreground text-background rounded-full px-6 py-3 text-sm font-medium"
          >
            Try again
          </button>
          <Link
            href="/"
            className="text-foreground rounded-full border border-[var(--sf-border)] px-6 py-3 text-sm font-medium"
          >
            Back to shop
          </Link>
        </div>
        {error.digest ? (
          <p className="text-caption text-muted-foreground mt-6">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
        <BrandDivider className="my-8" />
      </div>
    </div>
  );
}
