import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { getPublicEnv } from '@/config/env';
import { JsonLd } from '@/components/seo/json-ld';
import { BrandDivider } from '@/components/storefront/brand-divider';
import { slugify } from '@/lib/slugify';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface PageProps {
  params: Promise<{ citySlug: string }>;
}

interface OutletRow {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string | null;
  latitude: number;
  longitude: number;
  delivery_radius_km: number;
  phone: string | null;
}

async function getOutletsForCity(
  citySlug: string,
): Promise<{ city: string; outlets: OutletRow[] }> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('outlets')
    .select('id, name, slug, address, city, state, latitude, longitude, delivery_radius_km, phone')
    .eq('is_active', true)
    .is('deleted_at', null);

  const matches = ((data ?? []) as OutletRow[]).filter((o) => slugify(o.city) === citySlug);
  return { city: matches[0]?.city ?? '', outlets: matches };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { citySlug } = await params;
  const { city, outlets } = await getOutletsForCity(citySlug);
  if (outlets.length === 0) return { title: 'Location not found | Fresh & Petals' };
  return {
    title: `Flower delivery in ${city} | Fresh & Petals`,
    description: `Fresh & Petals delivers fresh flowers and bouquets in ${city} from ${outlets.length} local outlet${outlets.length === 1 ? '' : 's'}.`,
  };
}

/** Ch.3.11 Local SEO — one real page per city an active outlet actually
 * serves. LocalBusiness schema per outlet gives search engines the same
 * address/service-area data the page itself displays. */
export default async function LocationDetailPage({ params }: PageProps) {
  const { citySlug } = await params;
  const { city, outlets } = await getOutletsForCity(citySlug);
  if (outlets.length === 0) notFound();

  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;

  return (
    <div className="container-brand py-14">
      {outlets.map((outlet) => (
        <JsonLd
          key={outlet.id}
          data={{
            '@context': 'https://schema.org',
            '@type': 'FloristShop',
            name: `Fresh & Petals — ${outlet.name}`,
            address: {
              '@type': 'PostalAddress',
              streetAddress: outlet.address,
              addressLocality: outlet.city,
              ...(outlet.state ? { addressRegion: outlet.state } : {}),
              addressCountry: 'IN',
            },
            geo: {
              '@type': 'GeoCoordinates',
              latitude: outlet.latitude,
              longitude: outlet.longitude,
            },
            ...(outlet.phone ? { telephone: outlet.phone } : {}),
            url: `${appUrl}/locations/${citySlug}`,
            areaServed: {
              '@type': 'GeoCircle',
              geoMidpoint: {
                '@type': 'GeoCoordinates',
                latitude: outlet.latitude,
                longitude: outlet.longitude,
              },
              geoRadius: outlet.delivery_radius_km * 1000,
            },
          }}
        />
      ))}

      <Breadcrumb className="mb-8">
        <BreadcrumbList className="text-caption">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/" className="hover:text-[var(--gold-deep)]">
                Home
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="text-[var(--sf-border-strong)]" />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/locations" className="hover:text-[var(--gold-deep)]">
                Locations
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="text-[var(--sf-border-strong)]" />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-[var(--sf-ink)]">{city}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="mb-10 text-center">
        <p className="eyebrow mb-2">Same-day flower delivery</p>
        <h1 className="text-h1">Fresh & Petals in {city}</h1>
        <p className="text-body-lg mx-auto mt-4 max-w-xl">
          Hand-picked bouquets, arranged fresh and delivered from {outlets.length} local outlet
          {outlets.length === 1 ? '' : 's'} in {city}.
        </p>
        <BrandDivider className="mt-6" />
      </header>

      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {outlets.map((outlet) => (
          <div
            key={outlet.id}
            className="rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4"
          >
            <p className="text-h4">{outlet.name}</p>
            <p className="text-body mt-1 text-[var(--sf-ink-muted)]">{outlet.address}</p>
            <p className="text-caption mt-2">
              Delivers within {outlet.delivery_radius_km}km
              {outlet.phone ? ` · ${outlet.phone}` : ''}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link href="/shop" className="btn btn-primary inline-flex px-8 py-3.5 text-sm">
          Shop flowers for {city}
        </Link>
      </div>
    </div>
  );
}
