import { ProductForm } from '@/components/admin/product-form';

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-h2 text-foreground font-bold">Add product</h1>
      <ProductForm />
    </div>
  );
}
