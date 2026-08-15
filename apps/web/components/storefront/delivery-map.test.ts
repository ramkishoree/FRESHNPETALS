// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { extractComponents } from './delivery-map';

type Result = Parameters<typeof extractComponents>[0];

function makeResult(components: { long_name: string; types: string[] }[]): Result {
  return { address_components: components } as unknown as Result;
}

describe('extractComponents', () => {
  it('reads the pincode and locality off a geocoder result', () => {
    const result = makeResult([
      { long_name: 'Gomti Nagar', types: ['sublocality_level_1', 'sublocality'] },
      { long_name: 'Lucknow', types: ['locality'] },
      { long_name: '226010', types: ['postal_code'] },
    ]);

    expect(extractComponents(result)).toEqual({ postalCode: '226010', locality: 'Gomti Nagar' });
  });

  it('prefers the sublocality over the city', () => {
    // "Lucknow" alone is true and useless — every outlet is in Lucknow.
    const result = makeResult([
      { long_name: 'Lucknow', types: ['locality'] },
      { long_name: 'Aliganj', types: ['sublocality_level_1'] },
    ]);

    expect(extractComponents(result).locality).toBe('Aliganj');
  });

  it('falls back to the city when there is no sublocality', () => {
    const result = makeResult([{ long_name: 'Lucknow', types: ['locality'] }]);

    expect(extractComponents(result).locality).toBe('Lucknow');
  });

  it('reports nulls rather than inventing a pincode', () => {
    // The panel omits what it does not have. A guessed pincode would be
    // printed on the invoice as if the customer had given it.
    expect(extractComponents(makeResult([]))).toEqual({ postalCode: null, locality: null });
    expect(extractComponents(undefined)).toEqual({ postalCode: null, locality: null });
  });
});
