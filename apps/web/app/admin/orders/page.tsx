'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { LoadingState } from '@/components/states/loading-state';
import { Badge } from '@/components/ui/badge';

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
}

const STATUS_CLASS: Record<string, string> = {
  pending_payment: 'text-muted-foreground',
  paid: 'text-info-text',
  confirmed: 'text-info-text',
  preparing: 'text-warning-text',
  ready: 'text-warning-text',
  out_for_delivery: 'text-warning-text',
  delivered: 'text-success-text',
  completed: 'text-success-text',
  cancelled: 'text-destructive',
  failed: 'text-destructive',
  refunded: 'text-destructive',
};

/** Ch.12 §46 Orders Module + Ch.16 §97 Order Management API. */
export default function OrdersPage() {
  const [orders, setOrders] = React.useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/v1/admin/orders?limit=100');
        const body = await response.json();
        if (!response.ok || !body.success)
          throw new Error(body.error?.message ?? 'Failed to load.');
        setOrders(body.data.items as OrderRow[]);
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : 'Failed to load.');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  const columns: ColumnDef<OrderRow>[] = [
    {
      accessorKey: 'orderNumber',
      header: 'Order',
      cell: ({ row }) => (
        <Link
          href={`/admin/orders/${row.original.id}`}
          className="text-foreground font-medium hover:underline"
        >
          {row.original.orderNumber}
        </Link>
      ),
    },
    {
      accessorKey: 'grandTotal',
      header: 'Total',
      cell: ({ row }) => `₹${row.original.grandTotal}`,
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h2 text-foreground font-bold">Orders</h1>
        <p className="text-body text-muted-foreground">
          Every order, its fulfillment status, and total.
        </p>
      </div>

      {isLoading ? (
        <LoadingState variant="table-rows" count={6} />
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          searchKey="orderNumber"
          searchPlaceholder="Search order number..."
        />
      )}
    </div>
  );
}
