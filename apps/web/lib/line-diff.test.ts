import { describe, expect, it } from 'vitest';
import { diffLines } from './line-diff';

describe('diffLines', () => {
  it('marks everything unchanged for identical text', () => {
    const result = diffLines('a\nb\nc', 'a\nb\nc');
    expect(result).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'unchanged', text: 'b' },
      { type: 'unchanged', text: 'c' },
    ]);
  });

  it('detects a single added line', () => {
    const result = diffLines('a\nc', 'a\nb\nc');
    expect(result).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'added', text: 'b' },
      { type: 'unchanged', text: 'c' },
    ]);
  });

  it('detects a single removed line', () => {
    const result = diffLines('a\nb\nc', 'a\nc');
    expect(result).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'removed', text: 'b' },
      { type: 'unchanged', text: 'c' },
    ]);
  });

  it('detects a full replacement as remove + add', () => {
    const result = diffLines('old line', 'new line');
    expect(result).toEqual([
      { type: 'removed', text: 'old line' },
      { type: 'added', text: 'new line' },
    ]);
  });

  it('handles an empty old text (everything added)', () => {
    const result = diffLines('', 'a\nb');
    expect(result.filter((l) => l.type === 'added')).toHaveLength(2);
  });
});
