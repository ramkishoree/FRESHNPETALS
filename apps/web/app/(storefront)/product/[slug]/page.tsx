import type { Metadata } from 'next';
import Image from 'next/image';
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
import { ReviewCard } from '@/components/commerce/review-card';
import { BrandDivider } from '@/components/storefront/brand-divider';
import { ProductActions } from '@/components/storefront/product-actions';
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

  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, rating, title, comment, created_at, verified_purchase, customers(first_name)')
    .eq('product_id', product.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="container-brand py-10">
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
        <div className="relative overflow-hidden rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] shadow-[var(--shadow-md)]">
          <div className="relative aspect-square w-full">
            {product.featured_image && (
              <Image
                src={product.featured_image}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            )}
          </div>
        </div>

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

      <section className="mt-20 text-center">
        <p className="eyebrow mb-2">Loved by locals</p>
        <h2 className="text-h3">Customer reviews</h2>
        <BrandDivider className="my-6" />
        {(reviews ?? []).length === 0 ? (
          <p className="text-body-lg">No reviews yet.</p>
        ) : (
          <div className="grid gap-5 text-left md:grid-cols-3">
            {(reviews ?? []).map((review) => (
              <ReviewCard
                key={review.id}
                authorName={
                  (review.customers as unknown as { first_name?: string } | null)?.first_name ??
                  'Customer'
                }
                rating={review.rating}
                comment={review.comment ?? ''}
                createdAt={review.created_at}
                verifiedPurchase={review.verified_purchase}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
