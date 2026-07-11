import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandDivider } from '@/components/storefront/brand-divider';
import { slugify } from '@/lib/slugify';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Where we deliver | Fresh & Petals',
  description: 'Cities where Fresh & Petals currently delivers fresh flowers, from real outlets.',
};

interface OutletRow {
  id: string;
  city: string;
}

/**
 * Ch.3.11 Local SEO — real per-city landing pages, derived entirely from
 * the `outlets` table (city column) rather than a hand-picked list of
 * neighbourhoods this business may not actually serve. Scales
 * automatically as outlets are added; never claims coverage that
 * doesn't exist.
 */
export default async function LocationsIndexPage() {
  const supabase = await createSupabaseServerClient();
  const { data: outlets } = await supabase
    .from('outlets')
    .select('id, city')
    .eq('is_active', true)
    .is('deleted_at', null);

  const cityCounts = new Map<string, number>();
  for (const outlet of (outlets ?? []) as OutletRow[]) {
    cityCounts.set(outlet.city, (cityCounts.get(outlet.city) ?? 0) + 1);
  }
  const cities = [...cityCounts.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="container-brand py-14">
      <header className="mb-10 text-center">
        <p className="eyebrow mb-2">Where we deliver</p>
        <h1 className="text-h1">Fresh & Petals locations</h1>
        <BrandDivider className="mt-6" />
      </header>

      {cities.length === 0 ? (
        <p className="text-body-lg text-center">No active outlets right now — check back soon.</p>
      ) : (
        <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
          {cities.map(([city, count]) => (
            <Link
              key={city}
              href={`/locations/${slugify(city)}`}
              className="card-brand block p-6 text-center"
            >
              <p className="text-h4">{city}</p>
              <p className="text-caption mt-1">
                {count} outlet{count === 1 ? '' : 's'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
