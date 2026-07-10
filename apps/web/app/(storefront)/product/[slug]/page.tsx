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

/** Ch.12 §22 Product Detail Page — server-rendered for SEO. Buy Now adds to cart and jumps straight to /cart (real checkout is Phase 10). */
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
    <div className="container-brand space-y-10 py-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {category && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/shop/${category.slug}`}>{category.name}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage>{product.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-image bg-muted relative aspect-square overflow-hidden">
          {product.featured_image && (
            <Image
              src={product.featured_image}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          )}
        </div>

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

      <section className="max-w-3xl space-y-3">
        <h2 className="text-h3 text-foreground font-semibold">Description</h2>
        <p className="text-body text-foreground whitespace-pre-line">{product.description}</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-h3 text-foreground font-semibold">Reviews</h2>
        {(reviews ?? []).length === 0 ? (
          <p className="text-body text-muted-foreground">No reviews yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
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
