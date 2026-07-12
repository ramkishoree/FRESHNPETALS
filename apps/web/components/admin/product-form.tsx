'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import { ProductMediaGallery } from '@/components/admin/product-media-gallery';
import { ProductOutletStock } from '@/components/admin/product-outlet-stock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export interface ProductFormValues {
  sku: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  basePrice: string;
  salePrice: string;
  featuredImage: string;
}

const EMPTY_VALUES: ProductFormValues = {
  sku: '',
  slug: '',
  name: '',
  shortDescription: '',
  description: '',
  categoryId: '',
  basePrice: '',
  salePrice: '',
  featuredImage: '',
};

interface Category {
  id: string;
  name: string;
}

/** Ch.8 §19/§20: manual admin form covering the same fields the (Phase 11) AI Product Wizard will eventually pre-fill — the validation rules are identical either way (packages/commerce's validateAdminProductInput). */
export function ProductForm({
  productId,
  initialValues,
}: {
  productId?: string;
  initialValues?: Partial<ProductFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<ProductFormValues>({
    ...EMPTY_VALUES,
    ...initialValues,
  });
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    async function loadCategories() {
      const response = await fetch('/api/v1/admin/categories?limit=100');
      const body = await response.json();
      if (response.ok && body.success) setCategories(body.data.items as Category[]);
    }
    void loadCategories();
  }, []);

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);

    const payload = {
      sku: values.sku,
      slug: values.slug,
      name: values.name,
      shortDescription: values.shortDescription || undefined,
      description: values.description,
      categoryId: values.categoryId,
      basePrice: Number(values.basePrice),
      salePrice: values.salePrice ? Number(values.salePrice) : undefined,
      featuredImage: values.featuredImage,
    };

    try {
      const url = productId ? `/api/v1/admin/products/${productId}` : '/api/v1/admin/products';
      const response = await fetch(url, {
        method: productId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        const issues = body.error?.details?.violations as string[] | undefined;
        throw new Error(issues?.join(' ') ?? body.error?.message ?? 'Failed to save product.');
      }
      toast.success(productId ? 'Product updated.' : 'Product created.');
      router.push('/admin/products');
      router.refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to save product.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            required
            minLength={3}
            maxLength={120}
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            required
            pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
            value={values.slug}
            onChange={(e) => set('slug', e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sku">SKU *</Label>
          <Input
            id="sku"
            required
            disabled={Boolean(productId)}
            value={values.sku}
            onChange={(e) => set('sku', e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="category">Category *</Label>
          <Select value={values.categoryId} onValueChange={(v) => set('categoryId', v)}>
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="shortDescription">Short description</Label>
        <Input
          id="shortDescription"
          value={values.shortDescription}
          onChange={(e) => set('shortDescription', e.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="description">Description * (min. 100 characters)</Label>
        <Textarea
          id="description"
          required
          minLength={100}
          rows={5}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="basePrice">Price (₹) *</Label>
          <Input
            id="basePrice"
            type="number"
            required
            min={0.01}
            step="0.01"
            value={values.basePrice}
            onChange={(e) => set('basePrice', e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="salePrice">Sale price (₹)</Label>
          <Input
            id="salePrice"
            type="number"
            min={0}
            step="0.01"
            value={values.salePrice}
            onChange={(e) => set('salePrice', e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="featuredImage">Featured image *</Label>
        <ImageUploadField
          id="featuredImage"
          value={values.featuredImage}
          onChange={(url) => set('featuredImage', url)}
        />
      </div>

      <div className="grid gap-1.5">
        <Label>Additional photos &amp; videos</Label>
        <ProductMediaGallery productId={productId} />
      </div>

      <div className="grid gap-1.5">
        <Label>Stock per outlet</Label>
        <p className="text-caption text-muted-foreground -mt-1">
          Price, sale price, and photo are the same everywhere — only stock varies by outlet.
        </p>
        <ProductOutletStock productId={productId} />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : productId ? 'Save changes' : 'Create product'}
        </Button>
        {productId && values.slug && (
          <Button type="button" variant="outline" asChild>
            <a
              href={`/api/draft/enable?path=${encodeURIComponent(`/product/${values.slug}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Preview
            </a>
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => router.push('/admin/products')}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
