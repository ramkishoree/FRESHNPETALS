import * as React from 'react';

/**
 * Edit tokens for reviews written from this browser.
 *
 * A public reviewer has no account, so the only thing that can prove
 * they wrote a review is a secret handed to them when they wrote it.
 * localStorage rather than sessionStorage: coming back the next day to
 * fix a typo is the ordinary case, and losing the token means losing the
 * ability to edit — the review itself is unaffected either way.
 *
 * Nothing here is a security boundary. The server checks the token
 * against a stored hash; this is only where the browser keeps its copy.
 */
const KEY = 'fnp-my-reviews';

type TokenMap = Record<string, string>;

/**
 * Cached and published, not read fresh on every render.
 *
 * The list of reviews is server-rendered, so posting one refreshes the
 * page's data without remounting the component. Reading localStorage in
 * a mount-only effect meant a reviewer saw their own Edit and Remove
 * controls appear only after a manual reload. Subscribers are told when
 * the map changes instead.
 */
let cache: TokenMap | null = null;
const EMPTY_IDS: readonly string[] = [];
let idsSnapshot: readonly string[] = EMPTY_IDS;
const listeners = new Set<() => void>();

function read(): TokenMap {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    cache = parsed && typeof parsed === 'object' ? (parsed as TokenMap) : {};
  } catch {
    cache = {};
  }
  idsSnapshot = Object.keys(cache);
  return cache;
}

function write(map: TokenMap): void {
  cache = map;
  idsSnapshot = Object.keys(map);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // Private browsing can refuse storage. The review still posts; it
    // just cannot be edited later from this browser.
  }
  for (const listener of listeners) listener();
}

export function rememberReviewToken(reviewId: string, token: string): void {
  write({ ...read(), [reviewId]: token });
}

export function getReviewToken(reviewId: string): string | null {
  return read()[reviewId] ?? null;
}

export function forgetReviewToken(reviewId: string): void {
  const map = { ...read() };
  delete map[reviewId];
  write(map);
}

/** Ids of reviews this browser can edit, for deciding what to render. */
export function ownedReviewIds(): readonly string[] {
  read();
  return idsSnapshot;
}

/**
 * Subscribes a component to the set above.
 *
 * The server snapshot is deliberately a shared empty array: localStorage
 * does not exist there, and returning anything else would disagree with
 * the first client render and become a hydration error.
 */
export function useOwnedReviewIds(): readonly string[] {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => ownedReviewIds(),
    () => EMPTY_IDS,
  );
}

/** Test seam — drops the in-memory cache so storage is re-read. */
export function resetReviewTokenCache(): void {
  cache = null;
  idsSnapshot = EMPTY_IDS;
}
