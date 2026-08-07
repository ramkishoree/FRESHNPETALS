// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildOrderItemLabel, buildOrderItemsSummary } from './order-item-label';

describe('buildOrderItemLabel', () => {
  it('reads exactly as before when nothing optional is set', () => {
    // A product with no packing details must not gain stray punctuation.
    expect(buildOrderItemLabel({ name: 'Dozen Red Roses', quantity: 2 })).toBe(
      'Dozen Red Roses ×2',
    );
  });

  it('shows the colour when it is set', () => {
    expect(buildOrderItemLabel({ name: 'Anniversary Deluxe', quantity: 6, color: 'Red' })).toBe(
      'Anniversary Deluxe — Red ×6',
    );
  });

  it('treats whitespace-only values as absent', () => {
    // Admin text inputs produce these constantly.
    expect(buildOrderItemLabel({ name: 'Rose', quantity: 1, color: '   ' })).toBe('Rose ×1');
  });

  it('appends the owner note last, where it reads as an instruction', () => {
    expect(
      buildOrderItemLabel({
        name: 'Orchid Vase',
        quantity: 1,
        color: 'Purple',
        ownerDescription: 'use the tall glass vase',
      }),
    ).toBe('Orchid Vase — Purple ×1 (note: use the tall glass vase)');
  });
});

describe('buildOrderItemsSummary', () => {
  it('counts products and units separately', () => {
    const summary = buildOrderItemsSummary([
      { name: 'A', quantity: 2 },
      { name: 'B', quantity: 1 },
      { name: 'C', quantity: 6 },
    ]);

    expect(summary.startsWith('3 products, 9 units — ')).toBe(true);
  });

  it('uses singular wording for a single unit of a single product', () => {
    expect(buildOrderItemsSummary([{ name: 'A', quantity: 1 }])).toBe('1 product, 1 unit — A ×1');
  });

  it('never emits a newline or tab, which Meta rejects outright', () => {
    const summary = buildOrderItemsSummary([
      { name: 'A', quantity: 1, ownerDescription: 'line one\nline two\ttabbed' },
      { name: 'B', quantity: 1 },
    ]);

    // The note itself may contain them, so this is the guard that
    // matters: whatever goes into the parameter must be clean.
    expect(summary.replace(/[\n\t]/g, '')).toBe(summary);
  });

  it('stays inside Meta’s 1024-character parameter cap on a large order', () => {
    const items = Array.from({ length: 40 }, (_, index) => ({
      name: `Very Long Product Name Number ${index + 1}`,
      quantity: 3,
      color: 'Multicolour',
      ownerDescription:
        'handle with care, use the gold ribbon and the tall presentation hat box for this one',
    }));

    const summary = buildOrderItemsSummary(items);

    expect(summary.length).toBeLessThanOrEqual(1024);
    expect(summary).toContain('more item');
  });

  it('keeps the counts honest even when the list is truncated', () => {
    // The prefix is computed from the full order, so a truncated list
    // never understates what was actually bought.
    const items = Array.from({ length: 40 }, () => ({
      name: 'A Fairly Long Product Name Indeed',
      quantity: 2,
      ownerDescription: 'a reasonably long note about ribbons and vases and hat boxes',
    }));

    expect(buildOrderItemsSummary(items).startsWith('40 products, 80 units — ')).toBe(true);
  });

  it('falls back to a readable phrase for an order with no items', () => {
    expect(buildOrderItemsSummary([])).toBe('No items on file');
  });
});
