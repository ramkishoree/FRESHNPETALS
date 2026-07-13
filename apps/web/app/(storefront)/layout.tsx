import { headers } from 'next/headers';
import { getPublicEnv } from '@/config/env';
import { GoogleAnalytics } from '@/components/seo/google-analytics';
import { JsonLd } from '@/components/seo/json-ld';
import { AnnouncementBanner } from '@/components/storefront/announcement-banner';
import { SiteFooter } from '@/components/storefront/site-footer';
import { SiteHeader } from '@/components/storefront/site-header';
import { Spine } from '@/components/storefront/spine';

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const env = getPublicEnv();
  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const nonce = (await headers()).get('x-nonce') ?? undefined;

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
          '@type': 'Organization',
          name: 'Fresh & Petals',
          url: appUrl,
          logo: `${appUrl}/icon.svg`,
        }}
      />
      <SiteHeader />
      <AnnouncementBanner />
      <div className="spine-page spine-host relative flex-1">
        <Spine />
        {children}
      </div>
      <SiteFooter />
    </div>
  );
}
