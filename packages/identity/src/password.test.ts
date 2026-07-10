import { describe, expect, it } from 'vitest';
import { validatePassword } from './password';

describe('validatePassword', () => {
  it('accepts a password meeting every rule', () => {
    const result = validatePassword('Tr0picalBloom!');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a password shorter than 12 characters', () => {
    const result = validatePassword('Sh0rt!ab');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/at least 12 characters/);
  });

  it('rejects a password missing an uppercase letter', () => {
    const result = validatePassword('tr0picalbloom!');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/uppercase/);
  });

  it('rejects a password missing a lowercase letter', () => {
    const result = validatePassword('TR0PICALBLOOM!');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/lowercase/);
  });

  it('rejects a password missing a number', () => {
    const result = validatePassword('TropicalBloom!');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/number/);
  });

  it('rejects a password missing a special character', () => {
    const result = validatePassword('Tr0picalBloom12');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/special character/);
  });

  it('rejects a known common password even if it passes complexity rules', () => {
    const result = validatePassword('password123!');
    expect(result.errors.join(' ')).toMatch(/too common/);
  });

  it('accumulates multiple errors at once', () => {
    const result = validatePassword('short');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
