// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  everydayHours,
  openingHoursSpecs,
  outletArea,
  outletUrlSlug,
  toE164,
  type StorefrontOutlet,
} from './outlets';

function outlet(overrides: Partial<StorefrontOutlet> = {}): StorefrontOutlet {
  return {
    name: 'Fresh N Petals -Gomti Nagar',
    slug: 'freshnpetalsgomtinagar1',
    address: 'C-4, L.D.A Complex',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    latitude: 26.858171,
    longitude: 80.996993,
    phone: '07985430389',
    email: null,
    googlePlaceId: null,
    googleRating: null,
    googleRatingCount: null,
    workingHours: null,
    ...overrides,
  };
}

const ALL_DAY = {
  monday: '08:00-22:00',
  tuesday: '08:00-22:00',
  wednesday: '08:00-22:00',
  thursday: '08:00-22:00',
  friday: '08:00-22:00',
  saturday: '08:00-22:00',
  sunday: '08:00-22:00',
};

describe('toE164', () => {
  it('gives one shape to a number the admin stored two ways', () => {
    // The two outlet rows really do hold "7985430389" and "07985430389".
    // A telephone that disagrees with the Google Business Profile reads
    // as a NAP inconsistency.
    expect(toE164('7985430389')).toBe('+917985430389');
    expect(toE164('07985430389')).toBe('+917985430389');
    expect(toE164('+91 79854 30389')).toBe('+917985430389');
  });

  it('has nothing to say about a missing number', () => {
    expect(toE164(null)).toBeNull();
  });
});

describe('outletArea / outletUrlSlug', () => {
  it('reads the area out of the shop name, however it is spaced', () => {
    expect(outletArea(outlet())).toBe('Gomti Nagar');
    expect(outletArea(outlet({ name: 'Fresh N Petals - Arjunganj' }))).toBe('Arjunganj');
  });

  it('builds a URL out of the area, not the admin handle', () => {
    // The handle is "freshnpetalsgomtinagar1" — a trailing digit and no
    // word anyone searches for.
    expect(outletUrlSlug(outlet())).toBe('gomti-nagar');
    expect(outletUrlSlug(outlet({ name: 'Fresh N Petals - Arjunganj' }))).toBe('arjunganj');
  });

  it('falls back to the city when the name carries no area', () => {
    expect(outletArea(outlet({ name: 'Fresh N Petals' }))).toBe('Lucknow');
  });
});

describe('openingHoursSpecs', () => {
  it('collapses days that share a window into one specification', () => {
    const specs = openingHoursSpecs(outlet({ workingHours: ALL_DAY }));

    expect(specs).toHaveLength(1);
    expect(specs[0]?.dayOfWeek).toHaveLength(7);
    expect(specs[0]?.opens).toBe('08:00');
    expect(specs[0]?.closes).toBe('22:00');
  });

  it('keeps a day that differs as its own specification', () => {
    const specs = openingHoursSpecs(
      outlet({ workingHours: { ...ALL_DAY, sunday: '10:00-18:00' } }),
    );

    expect(specs).toHaveLength(2);
    expect(specs.find((s) => s.dayOfWeek.includes('Sunday'))?.closes).toBe('18:00');
  });

  it('emits nothing when hours are unset', () => {
    // Hours Google cannot corroborate are worse than no hours.
    expect(openingHoursSpecs(outlet())).toEqual([]);
  });

  it('ignores a malformed entry rather than emitting half a window', () => {
    expect(openingHoursSpecs(outlet({ workingHours: { monday: 'closed' } }))).toEqual([]);
  });
});

describe('everydayHours', () => {
  it('reads as a sentence when every day is the same', () => {
    expect(everydayHours(outlet({ workingHours: ALL_DAY }))).toBe('8am to 10pm, every day');
  });

  it('says nothing when the week is not uniform', () => {
    expect(
      everydayHours(outlet({ workingHours: { ...ALL_DAY, sunday: '10:00-18:00' } })),
    ).toBeNull();
    expect(everydayHours(outlet())).toBeNull();
  });
});
