import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
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
import { getCurrentUser } from '@/server/auth/session';
import { JsonLd } from '@/components/seo/json-ld';
import { DraftModeBanner } from '@/components/storefront/draft-mode-banner';
import { GoogleReviewsCarousel } from '@/components/storefront/google-reviews-carousel';
import { ProductActions } from '@/components/storefront/product-actions';
import { ProductGallery, type GalleryItem } from '@/components/storefront/product-gallery';
import { ProductReviews } from '@/components/storefront/product-reviews';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const isDraft = (await draftMode()).isEnabled;
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from('products')
    .select('name, seo_title, meta_description')
    .eq('slug', slug);
  if (!isDraft) query = query.eq('status', 'published');
  const { data } = await query.maybeSingle();
  if (!data) return { title: 'Product not found | Fresh & Petals' };
  return {
    title: data.seo_title ?? `${data.name} | Fresh & Petals`,
    description: data.meta_description ?? undefined,
  };
}

/** Ch.12 §22 Product Detail Page — server-rendered for SEO. Draft Mode
 * (admin Preview link) drops the `status = 'published'` filter so an
 * unpublished product can be reviewed before going live. */
export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const isDraft = (await draftMode()).isEnabled;
  const supabase = await createSupabaseServerClient();

  let productQuery = supabase
    .from('products')
    .select(
      'id, sku, slug, name, short_description, color, description, featured_image, status, categories(name, slug), product_prices(base_price, sale_price), inventory(available_quantity, outlets(is_active, deleted_at))',
    )
    .eq('slug', slug);
  if (!isDraft) productQuery = productQuery.eq('status', 'published');
  const { data: product } = await productQuery.maybeSingle();

  if (!product) notFound();

  const priceRow = Array.isArray(product.product_prices)
    ? product.product_prices[0]
    : product.product_prices;
  const category = Array.isArray(product.categories) ? product.categories[0] : product.categories;

  // Summed across active outlets only, matching how the listing card
  // decides "out of stock" — browsing happens before an outlet is
  // chosen, so 0 here means sold out everywhere. Checkout's per-outlet
  // reservation check stays the authoritative one at purchase time.
  const availableQuantity = (product.inventory ?? []).reduce((sum, row) => {
    const outlet = Array.isArray(row.outlets) ? row.outlets[0] : row.outlets;
    if (!outlet || !outlet.is_active || outlet.deleted_at) return sum;
    return sum + Number(row.available_quantity);
  }, 0);
  const outOfStock = availableQuantity <= 0;

  const [{ data: reviews }, { data: extraMedia }] = await Promise.all([
    supabase
      .from('reviews')
      .select(
        'id, rating, title, comment, created_at, verified_purchase, author_name, images, customers(first_name)',
      )
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

  // Public reviews publish instantly, so the owner gets an inline delete
  // control. Decided on the server — a customer never receives the
  // markup for it, rather than it being hidden with CSS.
  const currentUser = await getCurrentUser();
  const canModerate =
    currentUser?.roles.some((role) => role === 'administrator' || role === 'owner') ?? false;

  return (
    <div className="container-brand py-10">
      {isDraft && <DraftModeBanner status={product.status} />}
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
            // Now a real stock check rather than a restatement of
            // `status = 'published'`: the page fetches inventory across
            // active outlets, so Google is told OutOfStock when the buy
            // buttons are disabled. Advertising InStock for something a
            // shopper then cannot buy is exactly what earns a Merchant
            // Center mismatch.
            availability: outOfStock
              ? 'https://schema.org/OutOfStock'
              : 'https://schema.org/InStock',
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
            { '@type': 'ListItem', position: 1, name: 'Products', item: appUrl },
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
                Products
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
            color={product.color}
            image={product.featured_image}
            basePrice={priceRow ? Number(priceRow.base_price) : 0}
            salePrice={priceRow?.sale_price != null ? Number(priceRow.sale_price) : null}
            availableQuantity={availableQuantity}
          />

          {product.description && (
            <section className="mt-10">
              <p className="eyebrow mb-3">The details</p>
              <p className="text-body-lg whitespace-pre-line">{product.description}</p>
            </section>
          )}
        </div>
      </div>

      <ProductReviews
        productId={product.id}
        canModerate={canModerate}
        reviews={approvedReviews.map((review) => {
          const author = Array.isArray(review.customers) ? review.customers[0] : review.customers;
          return {
            id: review.id,
            // A public reviewer typed their own name; a signed-in
            // customer's comes from their profile.
            authorName: review.author_name ?? author?.first_name ?? 'Verified customer',
            rating: review.rating,
            comment: review.comment ?? review.title ?? '',
            createdAt: review.created_at,
            verifiedPurchase: review.verified_purchase ?? false,
            images: Array.isArray(review.images) ? (review.images as string[]) : [],
          };
        })}
        googleReviews={<GoogleReviewsCarousel />}
      />
    </div>
  );
}
