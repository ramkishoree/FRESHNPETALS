'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';
import { Badge } from '@/components/ui/badge';

interface OutletRow extends Record<string, unknown> {
  id: string;
  name: string;
  city: string;
  is_active: boolean;
  delivery_radius_km: number;
}

const columns: ColumnDef<OutletRow>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'city', header: 'City' },
  { accessorKey: 'delivery_radius_km', header: 'Delivery radius (km)' },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={row.original.is_active ? 'text-success-text' : 'text-muted-foreground'}
      >
        {row.original.is_active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
];

/** Ch.16 §96 Outlet Management API. */
export default function OutletsPage() {
  return (
    <AdminResourcePage
      title="Outlets"
      singularLabel="Outlet"
      description="Physical stores, delivery radius, and working hours."
      endpoint="/api/v1/admin/outlets"
      columns={columns}
      searchPlaceholder="Search outlets..."
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'slug', label: 'Slug', type: 'text', required: true },
        { name: 'address', label: 'Address', type: 'textarea', required: true },
        { name: 'city', label: 'City', type: 'text', required: true },
        { name: 'state', label: 'State', type: 'text' },
        { name: 'latitude', label: 'Latitude', type: 'number', required: true },
        { name: 'longitude', label: 'Longitude', type: 'number', required: true },
        { name: 'delivery_radius_km', label: 'Delivery radius (km)', type: 'number' },
        { name: 'phone', label: 'Phone', type: 'text' },
        { name: 'email', label: 'Email', type: 'text' },
        { name: 'is_active', label: 'Active', type: 'boolean' },
      ]}
    />
  );
}
