import { getPublicEnv } from '@/config/env';
import { JsonLd } from '@/components/seo/json-ld';
import { SiteFooter } from '@/components/storefront/site-footer';
import { SiteHeader } from '@/components/storefront/site-header';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .limit(8);

  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;

  return (
    <div className="storefront-theme flex min-h-dvh flex-col">
      {/* Organization schema, once, site-wide on every storefront page —
          not the admin panel, which has no reason to carry it. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Fresh & Petals',
          url: appUrl,
          logo: `${appUrl}/icon.svg`,
        }}
      />
      <SiteHeader categories={categories ?? []} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
