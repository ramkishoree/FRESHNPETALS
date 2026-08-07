'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { LoadingState } from '@/components/states/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ProductRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  color: string | null;
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

function buildColumns(onRemove: (row: ProductRow) => void): ColumnDef<ProductRow>[] {
  return [
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
      accessorKey: 'color',
      header: 'Colour',
      cell: ({ row }) => (row.original.color as string | null) ?? '—',
    },
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
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={() => onRemove(row.original)}
        >
          Remove
        </Button>
      ),
    },
  ];
}

/** Ch.12 §47 Product Module — Ch.16 §93 Product Management API. */
export default function ProductsPage() {
  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/admin/products?limit=100');
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? 'Failed to load.');
      setProducts(body.data.items as ProductRow[]);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to load.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /**
   * Archives rather than erases. Past orders and invoices still name the
   * product they were placed for — deleting the row outright would leave
   * blanks in records that have to stay accurate.
   */
  const removeProduct = React.useCallback(
    async (row: ProductRow) => {
      if (
        !window.confirm(
          `Remove "${row.name}" from the shop?\n\nIt disappears from the storefront immediately. Past orders and invoices keep showing it.`,
        )
      ) {
        return;
      }
      try {
        const response = await fetch(`/api/v1/admin/products/${row.id}`, { method: 'DELETE' });
        const body = await response.json();
        if (!response.ok || !body.success)
          throw new Error(body.error?.message ?? 'Failed to remove.');
        toast.success(`"${row.name}" removed from the shop.`);
        await load();
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : 'Failed to remove.');
      }
    },
    [load],
  );

  const columns = React.useMemo(() => buildColumns(removeProduct), [removeProduct]);

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
