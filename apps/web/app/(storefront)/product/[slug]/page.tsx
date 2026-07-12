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
import { GoogleReviewsCarousel } from '@/components/storefront/google-reviews-carousel';
import { ProductActions } from '@/components/storefront/product-actions';
import { ProductGallery, type GalleryItem } from '@/components/storefront/product-gallery';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('products')
    .select('name, seo_title, meta_description')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (!data) return { title: 'Product not found | Fresh & Petals' };
  return {
    title: data.seo_title ?? `${data.name} | Fresh & Petals`,
    description: data.meta_description ?? undefined,
  };
}

/** Ch.12 §22 Product Detail Page — server-rendered for SEO. */
export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: product } = await supabase
    .from('products')
    .select(
      'id, sku, slug, name, short_description, description, featured_image, status, categories(name, slug), product_prices(base_price, sale_price)',
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (!product) notFound();

  const priceRow = Array.isArray(product.product_prices)
    ? product.product_prices[0]
    : product.product_prices;
  const category = Array.isArray(product.categories) ? product.categories[0] : product.categories;

  const [{ data: reviews }, { data: extraMedia }] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, rating, title, comment, created_at, verified_purchase, customers(first_name)')
      .eq('product_id', product.id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('product_media')
      .select('media_type, url, thumbnail_url')
      .eq('product_id', product.id)
      .order('position', { ascending: true }),
  ]);

  const galleryItems: GalleryItem[] = [
    ...(product.featured_image ? [{ type: 'image' as const, url: product.featured_image }] : []),
    ...(extraMedia ?? []).map((item) => ({
      type: item.media_type as 'image' | 'video',
      url: item.url,
      ...(item.thumbnail_url ? { thumbnailUrl: item.thumbnail_url } : {}),
    })),
  ];

  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const productUrl = `${appUrl}/product/${product.slug}`;
  const displayPrice = priceRow?.sale_price ?? priceRow?.base_price ?? 0;
  const approvedReviews = reviews ?? [];

  return (
    <div className="container-brand py-10">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.short_description ?? product.description ?? undefined,
          sku: product.sku,
          ...(product.featured_image ? { image: [product.featured_image] } : {}),
          offers: {
            '@type': 'Offer',
            url: productUrl,
            priceCurrency: 'INR',
            price: Number(displayPrice),
            // Product detail only ever renders a `published` product (the
            // query above filters on it), and this app treats "published"
            // as "available for purchase" everywhere else too (see
            // server/checkout/start-checkout.ts) — real-time per-outlet
            // stock isn't fetched on this page, so this mirrors that same
            // existing status semantic rather than a live inventory check.
            availability: 'https://schema.org/InStock',
          },
          ...(approvedReviews.length > 0
            ? {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: (
                    approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length
                  ).toFixed(1),
                  reviewCount: approvedReviews.length,
                },
              }
            : {}),
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: appUrl },
            ...(category
              ? [
                  {
                    '@type': 'ListItem',
                    position: 2,
                    name: category.name,
                    item: `${appUrl}/shop/${category.slug}`,
                  },
                ]
              : []),
            {
              '@type': 'ListItem',
              position: category ? 3 : 2,
              name: product.name,
              item: productUrl,
            },
          ],
        }}
      />
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
          {category && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/shop/${category.slug}`} className="hover:text-[var(--gold-deep)]">
                    {category.name}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-[var(--sf-border-strong)]" />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage className="text-[var(--sf-ink)]">{product.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid gap-10 lg:grid-cols-2">
        {galleryItems.length > 0 ? (
          <ProductGallery items={galleryItems} name={product.name} />
        ) : (
          <div className="relative overflow-hidden rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] shadow-[var(--shadow-md)]">
            <div className="relative aspect-square w-full" />
          </div>
        )}

        <div className="lg:pt-4">
          <ProductActions
            productId={product.id}
            name={product.name}
            slug={product.slug}
            shortDescription={product.short_description}
            image={product.featured_image}
            basePrice={priceRow ? Number(priceRow.base_price) : 0}
            salePrice={priceRow?.sale_price != null ? Number(priceRow.sale_price) : null}
          />
        </div>
      </div>

      {product.description && (
        <section className="mt-16 max-w-3xl">
          <p className="eyebrow mb-3">The details</p>
          <p className="text-body-lg whitespace-pre-line">{product.description}</p>
        </section>
      )}

      <GoogleReviewsCarousel />
    </div>
  );
}
