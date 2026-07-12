import { describe, expect, it } from 'vitest';
import { assertNotTruncated, stripMarkdownFence } from './anthropic-adapter';

describe('stripMarkdownFence', () => {
  it('leaves plain JSON untouched', () => {
    expect(stripMarkdownFence('{"a":1}')).toBe('{"a":1}');
  });

  it('strips a ```json fence — the exact shape that broke blog-writer-ai in production', () => {
    const raw = '```json\n{\n"summary": "x",\n"confidence": 0.9\n}\n```';
    expect(stripMarkdownFence(raw)).toBe('{\n"summary": "x",\n"confidence": 0.9\n}');
  });

  it('strips a bare ``` fence with no language tag', () => {
    expect(stripMarkdownFence('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('strips a single-line fence with no internal newlines', () => {
    expect(stripMarkdownFence('```json{"a":1}```')).toBe('{"a":1}');
  });
});

describe('assertNotTruncated', () => {
  it('does not throw for a normal end_turn completion', () => {
    expect(() => assertNotTruncated('end_turn', 16000)).not.toThrow();
  });

  it('throws a clear, actionable error when stopped by the max_tokens ceiling — the exact failure that took blog-writer-ai down in production', () => {
    expect(() => assertNotTruncated('max_tokens', 8000)).toThrow(/8000-token maxTokens ceiling/);
  });
});
