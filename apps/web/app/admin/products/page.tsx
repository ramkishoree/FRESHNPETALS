'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { OutletManagementPanel } from '@/components/admin/outlet-management-panel';
import { LoadingState } from '@/components/states/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ProductRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  status: string;
  basePrice: number;
  salePrice: number | null;
}

const STATUS_CLASS: Record<string, string> = {
  draft: 'text-muted-foreground',
  ai_generated: 'text-info-text',
  pending_review: 'text-warning-text',
  approved: 'text-info-text',
  published: 'text-success-text',
  out_of_stock: 'text-destructive',
  hidden: 'text-muted-foreground',
  archived: 'text-muted-foreground',
};

const columns: ColumnDef<ProductRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <Link
        href={`/admin/products/${row.original.id}`}
        className="text-foreground font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  { accessorKey: 'sku', header: 'SKU' },
  {
    id: 'price',
    header: 'Price',
    cell: ({ row }) =>
      row.original.salePrice != null ? (
        <span>
          <span className="text-muted-foreground line-through">₹{row.original.basePrice}</span>{' '}
          <span className="text-foreground font-medium">₹{row.original.salePrice}</span>
        </span>
      ) : (
        <span>₹{row.original.basePrice}</span>
      ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant="outline" className={STATUS_CLASS[row.original.status] ?? ''}>
        {row.original.status.replace(/_/g, ' ')}
      </Badge>
    ),
  },
];

/** Ch.12 §47 Product Module — Ch.16 §93 Product Management API. */
export default function ProductsPage() {
  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/v1/admin/products?limit=100');
        const body = await response.json();
        if (!response.ok || !body.success)
          throw new Error(body.error?.message ?? 'Failed to load.');
        setProducts(body.data.items as ProductRow[]);
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : 'Failed to load.');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 text-foreground font-bold">Products</h1>
          <p className="text-body text-muted-foreground">
            Catalog, pricing, and publishing status.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">Add product</Link>
        </Button>
      </div>

      <OutletManagementPanel />

      {isLoading ? (
        <LoadingState variant="table-rows" count={6} />
      ) : (
        <DataTable
          columns={columns}
          data={products}
          searchKey="name"
          searchPlaceholder="Search products..."
        />
      )}
    </div>
  );
}
