import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, mapResult, ok, unwrapOr } from './result';

describe('Result', () => {
  it('ok() produces a success result', () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
    if (isOk(result)) expect(result.value).toBe(42);
  });

  it('err() produces a failure result', () => {
    const result = err('failed');
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
    if (isErr(result)) expect(result.error).toBe('failed');
  });

  it('mapResult transforms an Ok value and passes through an Err untouched', () => {
    expect(mapResult(ok(2), (n) => n * 2)).toEqual(ok(4));
    const failure = err('nope');
    expect(mapResult(failure, (n: number) => n * 2)).toBe(failure);
  });

  it('unwrapOr returns the value for Ok and the fallback for Err', () => {
    expect(unwrapOr(ok(5), 0)).toBe(5);
    expect(unwrapOr(err('nope'), 0)).toBe(0);
  });
});
