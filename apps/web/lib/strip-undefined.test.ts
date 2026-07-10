import { describe, expect, it } from 'vitest';
import { stripUndefined } from './strip-undefined';

describe('stripUndefined', () => {
  it('removes keys whose value is undefined', () => {
    expect(stripUndefined({ a: 1, b: undefined, c: 'x' })).toEqual({ a: 1, c: 'x' });
  });

  it('keeps falsy-but-defined values', () => {
    expect(stripUndefined({ a: 0, b: '', c: false, d: null })).toEqual({
      a: 0,
      b: '',
      c: false,
      d: null,
    });
  });

  it('returns an empty object unchanged', () => {
    expect(stripUndefined({})).toEqual({});
  });
});
