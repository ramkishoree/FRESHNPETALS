import type { MetadataRoute } from 'next';
import { getPublicEnv } from '@/config/env';
import { slugify } from '@/lib/slugify';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/** Ch.16 — no sitemap existed anywhere before this; SEO Specialist AI's
 * "Schema Generation" capability had nothing to point search engines at.
 * Static content routes (`/about`, `/faq`, etc.) plus every published
 * product/blog and active category — real data, refetched on each
 * request (`revalidate` below), not a hand-maintained list that goes
 * stale. Transactional/auth-gated routes (`/cart`, `/checkout`,
 * `/login`, `/account/*`) are deliberately excluded — no SEO value, and
 * several require a session. */
export const revalidate = 3600;

const STATIC_ROUTES = [
  '',
  '/shop',
  '/blog',
  '/about',
  '/faq',
  '/contact',
  '/privacy',
  '/terms',
  '/delivery-policy',
  '/locations',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const admin = createSupabaseAdminClient();

  const [{ data: products }, { data: categories }, { data: blogs }, { data: outlets }] =
    await Promise.all([
      admin.from('products').select('slug, updated_at').eq('status', 'published'),
      admin
        .from('categories')
        .select('slug, updated_at')
        .eq('is_active', true)
        .is('deleted_at', null),
      admin.from('blogs').select('slug, updated_at').eq('status', 'published'),
      admin.from('outlets').select('city').eq('is_active', true).is('deleted_at', null),
    ]);

  const cities = [...new Set((outlets ?? []).map((o) => o.city))];

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${appUrl}${path}`,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.6,
  }));

  const productEntries: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
    url: `${appUrl}/product/${p.slug}`,
    lastModified: p.updated_at ?? undefined,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const categoryEntries: MetadataRoute.Sitemap = (categories ?? []).map((c) => ({
    url: `${appUrl}/shop/${c.slug}`,
    lastModified: c.updated_at ?? undefined,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const blogEntries: MetadataRoute.Sitemap = (blogs ?? []).map((b) => ({
    url: `${appUrl}/blog/${b.slug}`,
    lastModified: b.updated_at ?? undefined,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  const locationEntries: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${appUrl}/locations/${slugify(city)}`,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [
    ...staticEntries,
    ...productEntries,
    ...categoryEntries,
    ...blogEntries,
    ...locationEntries,
  ];
}
