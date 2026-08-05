import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-next-path';

describe('safeNextPath', () => {
  it('keeps an ordinary in-app path', () => {
    expect(safeNextPath('/checkout')).toBe('/checkout');
    expect(safeNextPath('/account/orders/123')).toBe('/account/orders/123');
    expect(safeNextPath('/shop?sort=price')).toBe('/shop?sort=price');
  });

  it('falls back when the value is missing', () => {
    expect(safeNextPath(null)).toBe('/account');
    expect(safeNextPath(undefined)).toBe('/account');
    expect(safeNextPath('')).toBe('/account');
  });

  it('honours a caller-supplied fallback', () => {
    expect(safeNextPath(null, '/cart')).toBe('/cart');
  });

  it('refuses a protocol-relative url, which would leave the site', () => {
    // `${origin}${next}` with next="//evil.example.com" produces
    // "https://freshnpetals.in//evil.example.com" — browsers treat the
    // leading `//` as a new host. This is the open-redirect case.
    expect(safeNextPath('//evil.example.com')).toBe('/account');
    expect(safeNextPath('//evil.example.com/path')).toBe('/account');
  });

  it('refuses a backslash-smuggled host, which some browsers normalise to //', () => {
    expect(safeNextPath('/\\evil.example.com')).toBe('/account');
    expect(safeNextPath('\\\\evil.example.com')).toBe('/account');
  });

  it('refuses an absolute url of any scheme', () => {
    expect(safeNextPath('https://evil.example.com')).toBe('/account');
    expect(safeNextPath('http://evil.example.com')).toBe('/account');
    expect(safeNextPath('javascript:alert(1)')).toBe('/account');
  });

  it('refuses anything not anchored at the site root', () => {
    expect(safeNextPath('account')).toBe('/account');
    expect(safeNextPath('../admin')).toBe('/account');
  });
});
