import 'server-only';

export interface GiftingOccasion {
  name: string;
  /** ISO date (yyyy-mm-dd), local calendar day — no time component. */
  date: string;
  angle: string;
}

/**
 * Ch.9 marketing-manager-ai autonomous trigger: "propose a campaign around
 * upcoming gifting occasions." Fixed-date occasions are computed for any
 * year; lunar Hindu festivals (Diwali, Raksha Bandhan, Karva Chauth, Holi,
 * Bhai Dooj) shift every year and there's no calendar-calculation library
 * wired in here — LUNAR_OCCASIONS below is manually sourced per year
 * (currently only 2026, verified against panchang sources as of this
 * writing) and needs a manual update each December for the year ahead.
 * Getting a festival date wrong misfires a real campaign suggestion on the
 * wrong day, so this deliberately doesn't guess: if a lunar occasion for
 * the requested year isn't in the table, it's simply not proposed rather
 * than proposed with a made-up date.
 */
const LUNAR_OCCASIONS: Record<number, GiftingOccasion[]> = {
  2026: [
    { name: 'Holi', date: '2026-03-04', angle: 'Bright, colorful bouquets for Holi celebrations.' },
    {
      name: 'Raksha Bandhan',
      date: '2026-08-28',
      angle: 'Flowers to send alongside a rakhi, sibling-gifting angle.',
    },
    {
      name: 'Karva Chauth',
      date: '2026-10-29',
      angle: 'Romantic arrangements for husbands to send.',
    },
    {
      name: 'Diwali',
      date: '2026-11-08',
      angle: 'Festive arrangements, corporate/family gifting angle.',
    },
    {
      name: 'Bhai Dooj',
      date: '2026-11-11',
      angle: 'Sibling-gifting angle, similar to Raksha Bandhan.',
    },
  ],
};

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = first.getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function fixedDateOccasions(year: number): GiftingOccasion[] {
  return [
    {
      name: "New Year's Day",
      date: `${year}-01-01`,
      angle: 'Fresh-start gifting, corporate gifting.',
    },
    {
      name: 'Rose Day',
      date: `${year}-02-07`,
      angle: "Opening day of Valentine's week — rose-forward bouquets.",
    },
    {
      name: "Valentine's Day",
      date: `${year}-02-14`,
      angle: 'Romantic bouquets, the single biggest flower-gifting day of the year.',
    },
    {
      name: "International Women's Day",
      date: `${year}-03-08`,
      angle: 'Appreciation bouquets for colleagues, mothers, friends.',
    },
    {
      name: "Mother's Day",
      date: nthWeekdayOfMonth(year, 5, 0, 2),
      angle: "Second Sunday of May — classic Mother's Day bouquets.",
    },
    {
      name: "Father's Day",
      date: nthWeekdayOfMonth(year, 6, 0, 3),
      angle:
        'Third Sunday of June — less flower-typical, worth a specific angle (plants, low-maintenance arrangements).',
    },
    {
      name: 'Friendship Day',
      date: nthWeekdayOfMonth(year, 8, 0, 1),
      angle: 'First Sunday of August — casual/bright bouquets between friends.',
    },
    { name: 'Christmas', date: `${year}-12-25`, angle: 'Festive arrangements, corporate gifting.' },
  ];
}

/** Every gifting occasion for `year`, sorted by date. */
export function getGiftingOccasions(year: number): GiftingOccasion[] {
  return [...fixedDateOccasions(year), ...(LUNAR_OCCASIONS[year] ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

/** Occasions falling within `withinDays` of `today` (inclusive), for the
 * autonomous marketing scan to decide whether there's anything to propose
 * right now. Spans a year boundary correctly (checks both the current and
 * next calendar year's occasion tables). */
export function getUpcomingGiftingOccasions(today: Date, withinDays: number): GiftingOccasion[] {
  const todayIso = today.toISOString().slice(0, 10);
  const horizon = new Date(today.getTime() + withinDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const candidates = [
    ...getGiftingOccasions(today.getUTCFullYear()),
    ...getGiftingOccasions(today.getUTCFullYear() + 1),
  ];

  return candidates.filter((occasion) => occasion.date >= todayIso && occasion.date <= horizon);
}
