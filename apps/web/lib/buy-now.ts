import type { CartLineItem } from '@/lib/cart-context';

/**
 * "Buy now" is one item bought on its own, deliberately kept out of the
 * basket.
 *
 * Putting it in the basket meant a customer who was part-way through
 * assembling an order, then bought one thing outright, came back to find
 * the basket emptied — the checkout clears whatever it just sold. So the
 * instant purchase lives here instead: checkout prefers it when present,
 * and only this is discarded once the order is placed.
 *
 * sessionStorage, not localStorage: it belongs to the tab and the moment.
 * A buy-now intent that outlived the browser session would ambush the
 * next visit by quietly replacing the basket at checkout.
 */
const KEY = 'fnp-buy-now';

export function setBuyNowItem(item: CartLineItem): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(item));
  } catch {
    // Private browsing can refuse storage. Checkout then falls back to
    // the basket, which is wrong but not broken — never a dead button.
  }
}

export function readBuyNowItem(): CartLineItem | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CartLineItem;
    return parsed?.productId && parsed.quantity > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function clearBuyNowItem(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clean up if storage was never available.
  }
}
