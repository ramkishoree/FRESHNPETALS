import { describe, expect, it } from 'vitest';
import { stripMarkdownFence } from './anthropic-adapter';

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
