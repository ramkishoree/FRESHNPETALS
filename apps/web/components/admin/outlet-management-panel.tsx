'use client';

import type { ColumnDef } from '@tanstack/react-table';
import * as React from 'react';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';
import { GooglePlacePickerDialog } from '@/components/admin/google-place-picker-dialog';
import { Badge } from '@/components/ui/badge';

interface OutletRow extends Record<string, unknown> {
  id: string;
  name: string;
  city: string;
  is_active: boolean;
  delivery_radius_km: number;
}

interface OutletGoogleStatus {
  id: string;
  name: string;
  google_business_name: string | null;
  google_rating: number | null;
  google_rating_count: number | null;
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

function GoogleBusinessSection() {
  const [outlets, setOutlets] = React.useState<OutletGoogleStatus[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const response = await fetch('/api/v1/admin/outlets?limit=100');
    const body = await response.json();
    if (response.ok && body.success) setOutlets(body.data.items as OutletGoogleStatus[]);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (isLoading || outlets.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-caption text-muted-foreground">
        Linking Google Business powers the review carousel on the homepage and product pages.
      </p>
      {outlets.map((outlet) => (
        <div key={outlet.id} className="flex items-center justify-between gap-3">
          <div>
            <p className="text-body text-foreground font-medium">{outlet.name}</p>
            {outlet.google_business_name ? (
              <p className="text-caption text-muted-foreground">
                Linked to &quot;{outlet.google_business_name}&quot;
                {outlet.google_rating != null &&
                  ` — ${outlet.google_rating}★ (${outlet.google_rating_count ?? 0} reviews)`}
              </p>
            ) : (
              <p className="text-caption text-muted-foreground">Not linked yet</p>
            )}
          </div>
          <GooglePlacePickerDialog outletId={outlet.id} outletName={outlet.name} onLinked={load} />
        </div>
      ))}
    </div>
  );
}

/**
 * Owner's explicit call: fold Outlets management into the Products tab
 * instead of a separate nav item — collapsed by default since store
 * locations rarely change, unlike the product table above it which is
 * the everyday view.
 */
export function OutletManagementPanel() {
  return (
    <details className="border-border rounded-card border">
      <summary className="text-body text-foreground cursor-pointer p-4 font-medium select-none">
        Outlets (store locations)
      </summary>
      <div className="space-y-6 border-t p-4">
        <GoogleBusinessSection />
        <AdminResourcePage
          title="Outlets"
          singularLabel="Outlet"
          description="Physical stores and delivery radius. Exact coordinates come from linking Google Business above, not manual entry."
          endpoint="/api/v1/admin/outlets"
          columns={columns}
          searchPlaceholder="Search outlets..."
          fields={[
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'slug', label: 'Slug', type: 'text', required: true },
            { name: 'address', label: 'Address', type: 'textarea', required: true },
            { name: 'city', label: 'City', type: 'text', required: true },
            { name: 'state', label: 'State', type: 'text' },
            { name: 'delivery_radius_km', label: 'Delivery radius (km)', type: 'number' },
            { name: 'phone', label: 'Phone', type: 'text' },
            { name: 'email', label: 'Email', type: 'text' },
            { name: 'is_active', label: 'Active', type: 'boolean' },
            {
              name: 'google_cover_photo_url',
              label: 'Cover photo',
              type: 'image',
              helperText: 'Shown in the "Our outlets" section on the homepage.',
            },
          ]}
        />
      </div>
    </details>
  );
}
