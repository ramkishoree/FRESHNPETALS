import { headers } from 'next/headers';
import { getPublicEnv } from '@/config/env';
import { GoogleAnalytics } from '@/components/seo/google-analytics';
import { JsonLd } from '@/components/seo/json-ld';
import { AnnouncementBanner } from '@/components/storefront/announcement-banner';
import { PageViewTracker } from '@/components/storefront/page-view-tracker';
import { SiteFooter } from '@/components/storefront/site-footer';
import { SiteHeader } from '@/components/storefront/site-header';
import { Spine } from '@/components/storefront/spine';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchOutlets, outletArea, toE164 } from '@/server/storefront/outlets';

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const env = getPublicEnv();
  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const supabase = await createSupabaseServerClient();
  const outlets = await fetchOutlets(supabase);

  return (
    <div className="storefront-theme flex min-h-dvh flex-col">
      {env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
        <GoogleAnalytics
          measurementId={env.NEXT_PUBLIC_GA_MEASUREMENT_ID}
          {...(nonce ? { nonce } : {})}
        />
      )}
      {/* Organization schema, once, site-wide on every storefront page —
          not the admin panel, which has no reason to carry it. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              '@id': `${appUrl}#organization`,
              // The trading name, spelled the way the shopfront and the
              // Google Business Profiles spell it. The site used to say
              // "Fresh & Petals" here while every listing said "Fresh N
              // Petals", which is the sort of mismatch that stops a
              // brand and its profiles being treated as one entity.
              name: 'Fresh N Petals',
              alternateName: 'Fresh & Petals',
              url: appUrl,
              logo: `${appUrl}/icon.svg`,
              foundingDate: '2021',
              areaServed: { '@type': 'City', name: 'Lucknow' },
              ...(outlets[0]?.phone
                ? {
                    contactPoint: {
                      '@type': 'ContactPoint',
                      telephone: toE164(outlets[0].phone),
                      contactType: 'customer service',
                      areaServed: 'IN',
                      availableLanguage: ['en', 'hi'],
                    },
                  }
                : {}),
            },
            {
              '@type': 'WebSite',
              '@id': `${appUrl}#website`,
              url: appUrl,
              name: 'Fresh N Petals',
              publisher: { '@id': `${appUrl}#organization` },
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: `${appUrl}/search?q={search_term_string}`,
                },
                'query-input': 'required name=search_term_string',
              },
            },
            // Both shops, on every page. A florist is found through local
            // search far more than through the catalogue, and each branch
            // has to be a distinct place with its own coordinates for
            // that to work at all.
            ...outlets.map((outlet) => ({
              '@type': 'Florist',
              '@id': `${appUrl}/flower-shop/${outlet.slug}`,
              name: outlet.name,
              url: `${appUrl}/flower-shop/${outlet.slug}`,
              ...(toE164(outlet.phone) ? { telephone: toE164(outlet.phone) } : {}),
              priceRange: '₹₹',
              address: {
                '@type': 'PostalAddress',
                streetAddress: outlet.address,
                addressLocality: outlet.city,
                addressRegion: outlet.state,
                addressCountry: 'IN',
              },
              geo: {
                '@type': 'GeoCoordinates',
                latitude: outlet.latitude,
                longitude: outlet.longitude,
              },
              parentOrganization: { '@id': `${appUrl}#organization` },
              areaServed: { '@type': 'City', name: outlet.city },
              ...(outlet.googleRating && outlet.googleRatingCount
                ? {
                    aggregateRating: {
                      '@type': 'AggregateRating',
                      ratingValue: outlet.googleRating,
                      reviewCount: outlet.googleRatingCount,
                    },
                  }
                : {}),
            })),
          ],
        }}
      />
      <PageViewTracker />
      <SiteHeader />
      <AnnouncementBanner />
      <div className="spine-page spine-host relative flex-1">
        <Spine />
        {children}
      </div>
      <SiteFooter
        outlets={outlets.map((outlet) => ({
          name: outlet.name,
          slug: outlet.slug,
          area: outletArea(outlet),
          address: outlet.address,
          city: outlet.city,
          phone: toE164(outlet.phone),
        }))}
      />
    </div>
  );
}
