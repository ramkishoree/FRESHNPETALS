import type { MetadataRoute } from 'next';
import { getPublicEnv } from '@/config/env';

/** Ch.16 — disallows everything that isn't public storefront content:
 * the admin panel, the API surface, auth-gated account pages, and the
 * transactional checkout flow (mid-payment URLs have no business being
 * indexed or crawled). */
export default function robots(): MetadataRoute.Robots {
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/account', '/checkout', '/auth', '/login', '/signup'],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
