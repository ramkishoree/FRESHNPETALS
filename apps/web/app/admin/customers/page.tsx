'use client';

import type { ColumnDef } from '@tanstack/react-table';
import * as React from 'react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { LoadingState } from '@/components/states/loading-state';
import { Badge } from '@/components/ui/badge';

interface CustomerRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  lifetime_value: number;
  total_orders: number;
  status: string;
}

const STATUS_CLASS: Record<string, string> = {
  active: 'text-success-text',
  flagged: 'text-warning-text',
  blocked: 'text-destructive',
};

/** Ch.12 §55 Customer Module + Ch.16 §98 Customer Management API. */
export default function CustomersPage() {
  const [customers, setCustomers] = React.useState<CustomerRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/v1/admin/customers?limit=100');
        const body = await response.json();
        if (!response.ok || !body.success)
          throw new Error(body.error?.message ?? 'Failed to load.');
        setCustomers(body.data.items as CustomerRow[]);
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : 'Failed to load.');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  const columns: ColumnDef<CustomerRow>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) =>
        `${row.original.first_name ?? ''} ${row.original.last_name ?? ''}`.trim() || '—',
    },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'total_orders', header: 'Orders' },
    {
      accessorKey: 'lifetime_value',
      header: 'Lifetime value',
      cell: ({ row }) => `₹${row.original.lifetime_value}`,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="outline" className={STATUS_CLASS[row.original.status] ?? ''}>
          {row.original.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h2 text-foreground font-bold">Customers</h1>
        <p className="text-body text-muted-foreground">
          Profiles, order history, and lifetime value.
        </p>
      </div>

      {isLoading ? (
        <LoadingState variant="table-rows" count={6} />
      ) : (
        <DataTable
          columns={columns}
          data={customers}
          searchKey="email"
          searchPlaceholder="Search by email..."
        />
      )}
    </div>
  );
}
