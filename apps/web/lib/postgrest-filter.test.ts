import { describe, expect, it } from 'vitest';
import { sanitizeForPostgrestFilter } from './postgrest-filter';

describe('sanitizeForPostgrestFilter', () => {
  it('passes ordinary keyword queries through unchanged', () => {
    expect(sanitizeForPostgrestFilter('red roses')).toBe('red roses');
  });

  it('strips characters PostgREST treats as filter-structural', () => {
    expect(sanitizeForPostgrestFilter('rose),status.eq.published,(id.eq.1')).toBe(
      'rose  status eq published  id eq 1',
    );
  });

  it('neutralizes an attempted filter-injection payload', () => {
    const injected = sanitizeForPostgrestFilter('x)/status.neq.deleted,or=(id.gt.0');
    expect(injected).not.toMatch(/[,()]/);
  });
});
