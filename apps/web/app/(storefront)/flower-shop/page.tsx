import * as React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { getPublicEnv } from '@/config/env';
import { JsonLd } from '@/components/seo/json-ld';
import { StoreLocator } from '@/components/storefront/store-locator';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  everydayHours,
  fetchOutlets,
  outletArea,
  outletUrlSlug,
  toE164,
} from '@/server/storefront/outlets';

export const metadata: Metadata = {
  title: 'Our Flower Shops in Lucknow',
  description:
    'Find a Fresh N Petals flower shop in Lucknow — Gomti Nagar and Arjunganj. Addresses, phone numbers, opening hours and directions, plus same-day delivery across the city.',
  alternates: { canonical: '/flower-shop' },
  openGraph: {
    title: 'Our Flower Shops in Lucknow — Fresh N Petals',
    description: 'Gomti Nagar and Arjunganj. Addresses, hours, directions and same-day delivery.',
    url: '/flower-shop',
    type: 'website',
  },
};

/**
 * The store locator.
 *
 * Built from the `outlets` table rather than from Google's Quick Builder
 * component, which the owner supplied. That component pulls a ~300KB
 * module from ajax.googleapis.com, which would mean widening `script-src`
 * and giving back a good part of the image-weight work — for a list of
 * two shops whose addresses, coordinates, phone numbers, ratings and
 * hours this site already holds. The map is an Embed API iframe instead:
 * one lazy-loaded frame, no JavaScript of ours, and it cannot go stale
 * against the database because it is built from the same row.
 */
export default async function FlowerShopsPage() {
  const supabase = await createSupabaseServerClient();
  const outlets = await fetchOutlets(supabase);
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const mapsKey = getPublicEnv().NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  // The CSP carries `strict-dynamic`, so a host allowlist would be
  // ignored by any browser that understands it — a nonce is what lets
  // the component's module load, and what lets the modules it imports
  // load in turn.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <div className="container-brand py-10 pb-20">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Fresh N Petals flower shops in Lucknow',
          itemListElement: outlets.map((outlet, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: `${appUrl}/flower-shop/${outletUrlSlug(outlet)}`,
            name: outlet.name,
          })),
        }}
      />

      <h1 className="text-h2">Our Flower Shops in Lucknow</h1>
      <p className="text-body-lg mt-4 max-w-2xl">
        Two shops, both delivering across Lucknow. Come and choose in person, or order online and we
        will deliver from whichever shop is nearest to you.
      </p>

      {mapsKey && (
        <section className="mt-8" aria-label="Find a shop on the map">
          {/* Google's own loader and locator. Rendered after the list, so
              the page's indexable content is not behind a script. */}
          <script
            async
            type="module"
            nonce={nonce}
            src="https://ajax.googleapis.com/ajax/libs/@googlemaps/extended-component-library/0.6.15/index.min.js"
          />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- custom element, no JSX typing ships with the library */}
          {React.createElement('gmpx-api-loader' as any, {
            key: mapsKey,
            'solution-channel': 'GMP_QB_locatorplus_v11_cABD',
          })}
          <StoreLocator
            locations={outlets.map((outlet) => ({
              title: outlet.name,
              address1: outlet.address,
              address2: `${outlet.city}, ${outlet.state}`,
              coords: { lat: outlet.latitude, lng: outlet.longitude },
              placeId: outlet.googlePlaceId,
            }))}
          />
        </section>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        {outlets.map((outlet) => {
          const area = outletArea(outlet);
          const phone = toE164(outlet.phone);
          const hours = everydayHours(outlet);
          const directions = outlet.googlePlaceId
            ? `https://www.google.com/maps/search/?api=1&query=${outlet.latitude},${outlet.longitude}&query_place_id=${outlet.googlePlaceId}`
            : `https://www.google.com/maps/search/?api=1&query=${outlet.latitude},${outlet.longitude}`;

          return (
            <section
              key={outlet.slug}
              className="rounded-[var(--r-lg)] border border-[var(--sf-border)] p-5"
            >
              <h2 className="text-h4 font-semibold">
                <Link
                  href={`/flower-shop/${outletUrlSlug(outlet)}`}
                  className="hover:text-[var(--gold-deep)]"
                >
                  Flower shop in {area}
                </Link>
              </h2>

              <address className="text-body mt-2 not-italic">
                {outlet.address}
                <br />
                {outlet.city}, {outlet.state}
              </address>

              {hours && <p className="text-body mt-3">Open {hours}</p>}

              {outlet.googleRating && outlet.googleRatingCount ? (
                <p className="text-caption mt-1">
                  {outlet.googleRating} out of 5 from {outlet.googleRatingCount} Google reviews
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {phone && (
                  <a href={`tel:${phone}`} className="act">
                    Call {phone}
                  </a>
                )}
                <a href={directions} target="_blank" rel="noopener noreferrer" className="act">
                  Directions
                </a>
                <Link href={`/flower-shop/${outletUrlSlug(outlet)}`} className="act">
                  About this shop
                </Link>
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-body mt-12">
        <Link href="/" className="act">
          Browse the full catalogue
        </Link>
      </p>
    </div>
  );
}
