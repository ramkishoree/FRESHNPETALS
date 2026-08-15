import { beforeEach, describe, expect, it } from 'vitest';
import {
  forgetReviewToken,
  getReviewToken,
  ownedReviewIds,
  rememberReviewToken,
  resetReviewTokenCache,
} from './my-reviews';

describe('my reviews', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // The module caches storage in memory so a product page does not
    // re-parse it on every render; each test needs a clean read.
    resetReviewTokenCache();
  });

  it('remembers a token per review', () => {
    rememberReviewToken('review-a', 'token-a');
    rememberReviewToken('review-b', 'token-b');

    expect(getReviewToken('review-a')).toBe('token-a');
    expect(getReviewToken('review-b')).toBe('token-b');
    expect([...ownedReviewIds()].sort()).toEqual(['review-a', 'review-b']);
  });

  it('claims nothing for a review written elsewhere', () => {
    // Deciding to show Edit/Remove hangs on this: a false positive would
    // offer controls that then fail against the server.
    expect(getReviewToken('someone-elses')).toBeNull();
    expect(ownedReviewIds()).toEqual([]);
  });

  it('forgets only the review that was withdrawn', () => {
    rememberReviewToken('review-a', 'token-a');
    rememberReviewToken('review-b', 'token-b');

    forgetReviewToken('review-a');

    expect(getReviewToken('review-a')).toBeNull();
    expect(getReviewToken('review-b')).toBe('token-b');
  });

  it('survives corrupt storage rather than throwing on a product page', () => {
    window.localStorage.setItem('fnp-my-reviews', '{not json');
    resetReviewTokenCache();

    expect(ownedReviewIds()).toEqual([]);
    expect(getReviewToken('review-a')).toBeNull();

    // ...and writing over it recovers.
    rememberReviewToken('review-a', 'token-a');
    expect(getReviewToken('review-a')).toBe('token-a');
  });
});
