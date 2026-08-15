'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

function buildColumns(
  onRemove: (row: ProductRow) => void,
  onDuplicate: (row: ProductRow) => void,
): ColumnDef<ProductRow>[] {
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
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onDuplicate(row.original)}>
            Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => onRemove(row.original)}
          >
            Remove
          </Button>
        </div>
      ),
    },
  ];
}

/** Ch.12 §47 Product Module — Ch.16 §93 Product Management API. */
export default function ProductsPage() {
  const router = useRouter();
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

  /**
   * Most listings here are variations on one another, so copying beats
   * retyping the description, price, category and photo. The copy opens
   * hidden from the shop — it still carries the original's name and
   * image, so it is never something you'd want live the instant the
   * button is pressed.
   */
  const duplicateProduct = React.useCallback(
    async (row: ProductRow) => {
      try {
        const response = await fetch(`/api/v1/admin/products/${row.id}/duplicate`, {
          method: 'POST',
        });
        const body = await response.json();
        if (!response.ok || !body.success) {
          throw new Error(body.error?.message ?? 'Failed to duplicate.');
        }
        toast.success(`Copied "${row.name}". Opening the hidden copy…`);
        router.push(`/admin/products/${body.data.id}`);
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : 'Failed to duplicate.');
      }
    },
    [router],
  );

  const columns = React.useMemo(
    () => buildColumns(removeProduct, duplicateProduct),
    [removeProduct, duplicateProduct],
  );

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
