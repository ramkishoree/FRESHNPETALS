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

function read(): TokenMap {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as TokenMap) : {};
  } catch {
    return {};
  }
}

function write(map: TokenMap): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // Private browsing can refuse storage. The review still posts; it
    // just cannot be edited later from this browser.
  }
}

export function rememberReviewToken(reviewId: string, token: string): void {
  write({ ...read(), [reviewId]: token });
}

export function getReviewToken(reviewId: string): string | null {
  return read()[reviewId] ?? null;
}

export function forgetReviewToken(reviewId: string): void {
  const map = read();
  delete map[reviewId];
  write(map);
}

/** Ids of reviews this browser can edit, for deciding what to render. */
export function ownedReviewIds(): string[] {
  return Object.keys(read());
}
