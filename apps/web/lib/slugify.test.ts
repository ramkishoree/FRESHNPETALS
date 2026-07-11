import { describe, expect, it } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and hyphenates a plain city name', () => {
    expect(slugify('Lucknow')).toBe('lucknow');
  });

  it('collapses spaces and punctuation into single hyphens', () => {
    expect(slugify('New  Delhi, NCR')).toBe('new-delhi-ncr');
  });

  it('trims leading/trailing hyphens produced by leading/trailing punctuation', () => {
    expect(slugify('  -Lucknow-  ')).toBe('lucknow');
  });
});
