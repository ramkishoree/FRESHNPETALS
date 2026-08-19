import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { JsonLd } from '@/components/seo/json-ld';
import { AddToCartProductGrid } from '@/components/storefront/add-to-cart-product-grid';
import { getPublicEnv } from '@/config/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  everydayHours,
  fetchOutlets,
  openingHoursSpecs,
  outletArea,
  outletUrlSlug,
  toE164,
  type StorefrontOutlet,
} from '@/server/storefront/outlets';
import {
  mapProductRow,
  PRODUCT_SELECT_COLUMNS,
  sortProducts,
  sortToOrderBy,
} from '@/server/storefront/shop-query';

/**
 * A page per shop, because "florist in Gomti Nagar" and "florist in
 * Arjunganj" are different searches and a single storefront answers
 * neither of them specifically.
 *
 * `/locations` and `/locations/[city]` are permanently redirected to `/`
 * in next.config, so this deliberately does not reuse that path — these
 * are shops, not a city directory, and the URL says which shop.
 */
interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Accepts the readable URL slug, and also the internal admin slug so the
 * handful of links that briefly carried it do not 404. The page body
 * redirects the latter rather than serving both, which would be the same
 * shop on two URLs.
 */
async function loadOutlet(slug: string): Promise<StorefrontOutlet | null> {
  const supabase = await createSupabaseServerClient();
  const outlets = await fetchOutlets(supabase);
  return (
    outlets.find((outlet) => outletUrlSlug(outlet) === slug) ??
    outlets.find((outlet) => outlet.slug === slug) ??
    null
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const outlet = await loadOutlet(slug);
  if (!outlet) return { title: 'Shop not found' };

  const area = outletArea(outlet);
  // The template adds "| Fresh N Petals", so this must not repeat it.
  const title = `Flower Shop in ${area}, Lucknow`;
  const description = `Fresh flowers, bouquets and gifts from our ${area} shop in Lucknow. Same-day delivery across ${area} and nearby areas. Order online or call ${toE164(outlet.phone) ?? ''}.`;

  return {
    title,
    description,
    alternates: { canonical: `/flower-shop/${outletUrlSlug(outlet)}` },
    openGraph: {
      title,
      description,
      url: `/flower-shop/${outletUrlSlug(outlet)}`,
      type: 'website',
    },
  };
}

export default async function FlowerShopPage({ params }: PageProps) {
  const { slug } = await params;
  const outlet = await loadOutlet(slug);
  if (!outlet) notFound();
  // Reached by the internal admin slug: send it to the readable one so
  // there is exactly one URL per shop.
  if (slug !== outletUrlSlug(outlet)) permanentRedirect(`/flower-shop/${outletUrlSlug(outlet)}`);

  const area = outletArea(outlet);
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const phone = toE164(outlet.phone);
  const supabase = await createSupabaseServerClient();
  const { column, ascending } = sortToOrderBy();

  const [{ data: productRows }, allOutlets] = await Promise.all([
    supabase
      .from('products')
      .select(PRODUCT_SELECT_COLUMNS)
      .eq('status', 'published')
      .order(column, { ascending })
      .limit(12),
    fetchOutlets(supabase),
  ]);
  const products = sortProducts((productRows ?? []).map(mapProductRow));
  const otherOutlets = allOutlets.filter((entry) => entry.slug !== outlet.slug);

  const mapsHref = outlet.googlePlaceId
    ? `https://www.google.com/maps/search/?api=1&query=${outlet.latitude},${outlet.longitude}&query_place_id=${outlet.googlePlaceId}`
    : `https://www.google.com/maps/search/?api=1&query=${outlet.latitude},${outlet.longitude}`;

  return (
    <div className="container-brand py-10 pb-20">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Florist',
          '@id': `${appUrl}/flower-shop/${outletUrlSlug(outlet)}`,
          name: outlet.name,
          url: `${appUrl}/flower-shop/${outletUrlSlug(outlet)}`,
          image: `${appUrl}/category-all.webp`,
          ...(phone ? { telephone: phone } : {}),
          ...(outlet.email ? { email: outlet.email } : {}),
          priceRange: '₹₹',
          currenciesAccepted: 'INR',
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
          ...(openingHoursSpecs(outlet).length > 0
            ? { openingHoursSpecification: openingHoursSpecs(outlet) }
            : {}),
          // Only stated when Google itself has rated the shop — an
          // aggregateRating a search engine cannot corroborate is worse
          // than none at all.
          ...(outlet.googleRating && outlet.googleRatingCount
            ? {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: outlet.googleRating,
                  reviewCount: outlet.googleRatingCount,
                },
              }
            : {}),
          areaServed: {
            '@type': 'City',
            name: 'Lucknow',
          },
          hasMap: mapsHref,
          parentOrganization: { '@type': 'Organization', name: 'Fresh N Petals', url: appUrl },
        }}
      />

      <nav aria-label="Breadcrumb" className="text-caption mb-6">
        <Link href="/" className="hover:text-[var(--gold-deep)]">
          Fresh N Petals
        </Link>
        <span className="mx-2 text-[var(--sf-border-strong)]">/</span>
        <span>Flower shop in {area}</span>
      </nav>

      <h1 className="text-h2">Flower Shop in {area}, Lucknow</h1>
      <p className="text-body-lg mt-4 max-w-2xl">
        Fresh N Petals has been making bouquets, baskets and gift arrangements in Lucknow since
        2021. Our {area} shop delivers fresh flowers across {area} and the surrounding areas, with
        same-day delivery on orders placed early enough in the day.
      </p>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="eyebrow mb-3">Visit this shop</h2>
          <address className="text-body not-italic">
            <strong className="block">{outlet.name}</strong>
            {outlet.address}
            <br />
            {outlet.city}, {outlet.state}
          </address>
          {phone && (
            <p className="mt-3">
              <a href={`tel:${phone}`} className="act">
                Call {phone}
              </a>
            </p>
          )}
          <p className="mt-2">
            <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="act">
              Get directions on Google Maps
            </a>
          </p>
          {everydayHours(outlet) && (
            <p className="text-body mt-3">
              <strong>Open</strong> {everydayHours(outlet)}
            </p>
          )}
          {outlet.googleRating && outlet.googleRatingCount ? (
            <p className="text-caption mt-3">
              Rated {outlet.googleRating} out of 5 from {outlet.googleRatingCount} Google reviews.
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="eyebrow mb-3">What we deliver here</h2>
          <ul className="text-body list-disc space-y-1 pl-5">
            <li>Bunch bouquets and hand-tied flowers</li>
            <li>Basket bouquets and vase arrangements</li>
            <li>Chocolate bouquets and gift hampers</li>
            <li>Indoor plants and bonsai</li>
            <li>Event and wedding flower services</li>
          </ul>
          <p className="mt-4">
            <Link href="/" className="act">
              Browse the full catalogue
            </Link>
          </p>
        </section>
      </div>

      {products.length > 0 && (
        <section className="mt-14">
          <h2 className="text-h4 mb-6 font-semibold">Order flowers for delivery in {area}</h2>
          <AddToCartProductGrid products={products} />
        </section>
      )}

      {otherOutlets.length > 0 && (
        <section className="mt-14">
          <h2 className="text-h4 mb-3 font-semibold">Our other shop in Lucknow</h2>
          <ul className="space-y-2">
            {otherOutlets.map((entry) => (
              <li key={entry.slug}>
                <Link href={`/flower-shop/${outletUrlSlug(entry)}`} className="act">
                  Flower shop in {outletArea(entry)}, Lucknow
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
