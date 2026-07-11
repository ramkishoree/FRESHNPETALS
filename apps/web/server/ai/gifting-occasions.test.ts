import { describe, expect, it } from 'vitest';
import { getGiftingOccasions, getUpcomingGiftingOccasions } from './gifting-occasions';

describe('getGiftingOccasions', () => {
  it("computes Mother's Day as the second Sunday of May", () => {
    const occasions = getGiftingOccasions(2026);
    const mothersDay = occasions.find((o) => o.name === "Mother's Day");
    expect(mothersDay?.date).toBe('2026-05-10');
  });

  it("computes Father's Day as the third Sunday of June", () => {
    const occasions = getGiftingOccasions(2026);
    const fathersDay = occasions.find((o) => o.name === "Father's Day");
    expect(fathersDay?.date).toBe('2026-06-21');
  });

  it('includes verified lunar occasions for a year that has them, none for a year without data', () => {
    expect(getGiftingOccasions(2026).some((o) => o.name === 'Diwali')).toBe(true);
    expect(getGiftingOccasions(2030).some((o) => o.name === 'Diwali')).toBe(false);
  });

  it('returns occasions sorted by date', () => {
    const dates = getGiftingOccasions(2026).map((o) => o.date);
    expect([...dates].sort()).toEqual(dates);
  });
});

describe('getUpcomingGiftingOccasions', () => {
  it("finds Valentine's Day when today is within the window", () => {
    const today = new Date('2026-02-01T00:00:00Z');
    const upcoming = getUpcomingGiftingOccasions(today, 30);
    expect(upcoming.some((o) => o.name === "Valentine's Day")).toBe(true);
  });

  it('excludes an occasion outside the window', () => {
    const today = new Date('2026-01-01T00:00:00Z');
    const upcoming = getUpcomingGiftingOccasions(today, 5);
    expect(upcoming.some((o) => o.name === "Valentine's Day")).toBe(false);
  });

  it('spans a year boundary correctly (checks next year too)', () => {
    const today = new Date('2026-12-20T00:00:00Z');
    const upcoming = getUpcomingGiftingOccasions(today, 15);
    expect(upcoming.some((o) => o.name === "New Year's Day")).toBe(true);
  });
});
