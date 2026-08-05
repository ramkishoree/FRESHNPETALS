// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { jpegSiblingUrl } from './jpeg-sibling';

describe('jpegSiblingUrl', () => {
  it('swaps a .webp object for the .jpg uploaded alongside it', () => {
    expect(
      jpegSiblingUrl(
        'https://swenryjqcdogbhvvwqvq.supabase.co/storage/v1/object/public/media/products/abc/1.webp',
      ),
    ).toBe(
      'https://swenryjqcdogbhvvwqvq.supabase.co/storage/v1/object/public/media/products/abc/1.jpg',
    );
  });

  it('is case-insensitive about the extension', () => {
    expect(jpegSiblingUrl('https://cdn.example.com/a/rose.WEBP')).toBe(
      'https://cdn.example.com/a/rose.jpg',
    );
  });

  it('keeps the query string, which Supabase uses for transforms', () => {
    expect(jpegSiblingUrl('https://cdn.example.com/a/rose.webp?width=800')).toBe(
      'https://cdn.example.com/a/rose.jpg?width=800',
    );
  });

  it('returns null for anything that is not a webp — there is no sibling to point at', () => {
    expect(jpegSiblingUrl('https://cdn.example.com/a/rose.jpg')).toBeNull();
    expect(jpegSiblingUrl('https://cdn.example.com/a/rose.png')).toBeNull();
    expect(jpegSiblingUrl('https://cdn.example.com/a/webp')).toBeNull();
  });

  it('returns null for an unparseable url rather than guessing', () => {
    expect(jpegSiblingUrl('/media/rose.webp')).toBeNull();
    expect(jpegSiblingUrl('')).toBeNull();
  });
});
