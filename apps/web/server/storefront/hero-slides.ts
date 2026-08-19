import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/server/logger';

export interface HeroSlideRecord {
  id: string;
  slotOrder: number;
  mediaUrl: string;
  captionText: string | null;
}

/**
 * The homepage hero band's slides.
 *
 * Lives in its own function because of how it used to fail. The page
 * fetched it inline and wrote `heroResult.data ?? []`, so a query that
 * came back with an error — rather than with no rows — was
 * indistinguishable from "the owner has not put anything in a slot". The
 * band simply was not rendered, no error was recorded anywhere, and a
 * reload usually fixed it. That is the exact shape of the intermittent
 * disappearance the owner reported.
 *
 * Two changes. A failure is now logged, so the next occurrence says what
 * happened instead of vanishing. And a failure is retried once, because
 * the likeliest cause is the 5s abort in `fetchWithTimeout` firing on a
 * cold connection: that budget exists to protect TTFB and should not be
 * raised, but one retry turns a single slow moment into a rendered hero
 * instead of a missing one.
 *
 * The retry is deliberately not a loop. If Supabase is genuinely down,
 * two attempts have already established it, and a homepage that spends
 * its render budget retrying is a worse outcome than a homepage with no
 * banner on it.
 */
export async function fetchHeroSlides(supabase: SupabaseClient): Promise<HeroSlideRecord[]> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { data, error } = await supabase
      .from('hero_slides')
      // `media_type` is filtered on rather than selected: the band is
      // stills only now, so a row left over from the brief video era is
      // skipped instead of being handed to <Image> as a broken picture.
      .select('id, slot_order, media_url, caption_text')
      .eq('is_active', true)
      .eq('media_type', 'image')
      .order('slot_order', { ascending: true });

    if (!error) {
      return (data ?? []).map((row) => ({
        id: row.id as string,
        slotOrder: row.slot_order as number,
        mediaUrl: row.media_url as string,
        captionText: (row.caption_text as string | null) ?? null,
      }));
    }

    logger.warn('hero_slides.fetch_failed', {
      attempt,
      message: error.message,
      code: error.code,
      willRetry: attempt === 1,
    });
  }

  // Both attempts failed. An empty band is the only thing left to
  // render, but now it is a recorded event rather than a silent one.
  logger.error('hero_slides.unavailable', {
    message: 'Hero band rendered empty because the query failed twice.',
  });
  return [];
}
