// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { fetchHeroSlides } from './hero-slides';

vi.mock('@/server/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

type Result = { data: unknown[] | null; error: { message: string; code?: string } | null };

/** A query builder whose chain is ignored and whose Nth call returns the Nth scripted result. */
function fakeSupabase(results: Result[]) {
  let call = 0;
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => Promise.resolve(results[call++] ?? results.at(-1)),
  };
  return { from: () => builder, calls: () => call } as unknown as SupabaseClient & {
    calls: () => number;
  };
}

const row = { id: 'slide-1', slot_order: 1, media_url: 'https://cdn/x.webp', caption_text: null };

describe('fetchHeroSlides', () => {
  it('maps the rows the owner has filled', async () => {
    const slides = await fetchHeroSlides(fakeSupabase([{ data: [row], error: null }]));

    expect(slides).toEqual([
      { id: 'slide-1', slotOrder: 1, mediaUrl: 'https://cdn/x.webp', captionText: null },
    ]);
  });

  it('retries once when the query errors, and renders the hero anyway', async () => {
    // The reported bug: a single transient failure — most likely the 5s
    // abort in fetchWithTimeout on a cold connection — blanked the band
    // until the visitor reloaded.
    const supabase = fakeSupabase([
      { data: null, error: { message: 'AbortError: signal timed out' } },
      { data: [row], error: null },
    ]);

    const slides = await fetchHeroSlides(supabase);

    expect(slides).toHaveLength(1);
  });

  it('gives up after two failures rather than retrying forever', async () => {
    // A homepage that spends its render budget retrying is worse than a
    // homepage with no banner.
    const supabase = fakeSupabase([
      { data: null, error: { message: 'down' } },
      { data: null, error: { message: 'down' } },
      { data: [row], error: null },
    ]);

    expect(await fetchHeroSlides(supabase)).toEqual([]);
    expect(supabase.calls()).toBe(2);
  });

  it('treats an empty table as empty, without a retry', async () => {
    // No slides is a legitimate answer — the owner may not have uploaded
    // one — and must not cost a second round trip on every render.
    const supabase = fakeSupabase([{ data: [], error: null }]);

    expect(await fetchHeroSlides(supabase)).toEqual([]);
    expect(supabase.calls()).toBe(1);
  });
});
