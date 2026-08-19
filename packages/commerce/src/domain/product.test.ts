import { describe, expect, it } from 'vitest';
import { deriveSeoDefaults, PRODUCT_LIMITS } from './product';

describe('deriveSeoDefaults', () => {
  it('appends the brand suffix to a short name', () => {
    const { seoTitle } = deriveSeoDefaults('Red Rose Bouquet', 'A'.repeat(120));
    expect(seoTitle).toBe('Red Rose Bouquet | Fresh N Petals');
    expect(seoTitle.length).toBeLessThanOrEqual(PRODUCT_LIMITS.seoTitleMax);
  });

  it('truncates instead of exceeding the SEO title limit for a long name', () => {
    const longName = 'A'.repeat(80);
    const { seoTitle } = deriveSeoDefaults(longName, 'B'.repeat(120));
    expect(seoTitle.length).toBeLessThanOrEqual(PRODUCT_LIMITS.seoTitleMax);
    expect(seoTitle).not.toContain('Fresh N Petals');
  });

  it('prefers the short description for the meta description when present', () => {
    const { metaDescription } = deriveSeoDefaults(
      'Rose Bouquet',
      'D'.repeat(200),
      'A dozen fresh red roses.',
    );
    expect(metaDescription).toBe('A dozen fresh red roses.');
  });

  it('falls back to the full description, truncated, when no short description is given', () => {
    const longDescription = 'C'.repeat(200);
    const { metaDescription } = deriveSeoDefaults('Rose Bouquet', longDescription);
    expect(metaDescription.length).toBeLessThanOrEqual(PRODUCT_LIMITS.metaDescriptionMax);
    expect(metaDescription.endsWith('…')).toBe(true);
  });

  it('derives a lowercase focus keyword from the name', () => {
    const { focusKeyword } = deriveSeoDefaults('Red Rose Bouquet', 'E'.repeat(120));
    expect(focusKeyword).toBe('red rose bouquet');
  });
});
