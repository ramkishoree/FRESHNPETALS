import { notFound } from 'next/navigation';
import { ProductForm } from '@/components/admin/product-form';
import { ProductStatusControl } from '@/components/admin/product-status-control';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

interface ProductDetailRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string;
  category_id: string;
  featured_image: string | null;
  color: string | null;
  flower_type: string | null;
  size_label: string | null;
  packaging: string | null;
  owner_note: string | null;
  seo_title: string | null;
  meta_description: string | null;
  status: string;
  metadata: { focusKeyword?: string } | null;
  product_prices: { base_price: string | number; sale_price: string | number | null } | null;
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('products')
    .select(
      'id, sku, slug, name, short_description, description, category_id, featured_image, color, flower_type, size_label, packaging, owner_note, seo_title, meta_description, status, metadata, product_prices(base_price, sale_price)',
    )
    .eq('id', id)
    .maybeSingle();

  if (!data) notFound();

  const product = data as unknown as ProductDetailRow;
  const price = Array.isArray(product.product_prices)
    ? product.product_prices[0]
    : product.product_prices;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 text-foreground font-bold">{product.name}</h1>
        <ProductStatusControl productId={product.id} currentStatus={product.status} />
      </div>

      <ProductForm
        productId={product.id}
        initialValues={{
          sku: product.sku,
          slug: product.slug,
          name: product.name,
          shortDescription: product.short_description ?? '',
          color: product.color ?? '',
          flowerType: product.flower_type ?? '',
          sizeLabel: product.size_label ?? '',
          packaging: product.packaging ?? '',
          ownerNote: product.owner_note ?? '',
          description: product.description,
          categoryId: product.category_id,
          basePrice: price ? String(price.base_price) : '',
          salePrice: price?.sale_price != null ? String(price.sale_price) : '',
          featuredImage: product.featured_image ?? '',
        }}
      />
    </div>
  );
}
