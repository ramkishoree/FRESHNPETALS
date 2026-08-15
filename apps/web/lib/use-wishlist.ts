'use client';

import * as React from 'react';
import { toast } from 'sonner';

/**
 * One shared answer to "is this saved?" for every heart on the page.
 *
 * Each component used to keep its own set, starting empty on every
 * navigation — so a product you had saved showed a hollow heart until
 * you clicked it again, and the listing and the product page could
 * disagree about the same product at the same time. The set lives at
 * module scope and is fetched once, so every heart mounted anywhere
 * reads the same truth.
 */
let ids: ReadonlySet<string> = new Set();
let hasLoaded = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: ReadonlySet<string>) {
  ids = next;
  for (const listener of listeners) listener();
}

async function load(): Promise<void> {
  if (hasLoaded) return;
  inFlight ??= (async () => {
    try {
      const response = await fetch('/api/v1/account/wishlist');
      // 401 is the ordinary answer for a signed-out visitor, not a
      // failure worth surfacing — they simply have nothing saved.
      if (response.ok) {
        const body = await response.json();
        if (body?.success) {
          const rows = (body.data ?? []) as { products?: { id?: string } | { id?: string }[] }[];
          const loaded = new Set<string>();
          for (const row of rows) {
            const product = Array.isArray(row.products) ? row.products[0] : row.products;
            if (product?.id) loaded.add(product.id);
          }
          publish(loaded);
        }
      }
    } catch {
      // Leaves every heart hollow, which is the safe way to be wrong:
      // clicking one still saves, it just can't show prior state.
    } finally {
      hasLoaded = true;
      inFlight = null;
    }
  })();
  return inFlight;
}

export function useWishlist() {
  const wishlistedIds = React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => ids,
    () => ids,
  );

  React.useEffect(() => {
    void load();
  }, []);

  const toggle = React.useCallback(async (productId: string) => {
    const wasSaved = ids.has(productId);
    try {
      const response = wasSaved
        ? await fetch(`/api/v1/account/wishlist/${productId}`, { method: 'DELETE' })
        : await fetch('/api/v1/account/wishlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId }),
          });

      if (response.status === 401) {
        toast.error('Sign in to save products to your wishlist.');
        return;
      }
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to update wishlist.');

      const next = new Set(ids);
      if (wasSaved) next.delete(productId);
      else next.add(productId);
      publish(next);

      toast.success(wasSaved ? 'Removed from wishlist.' : 'Added to wishlist.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to update wishlist.');
    }
  }, []);

  return { wishlistedIds, isWishlisted: (id: string) => wishlistedIds.has(id), toggle };
}

/** Lets the wishlist page drop a row without a refetch. */
export function forgetWishlisted(productId: string) {
  const next = new Set(ids);
  next.delete(productId);
  publish(next);
}
