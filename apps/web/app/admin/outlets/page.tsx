'use client';

import type { ColumnDef } from '@tanstack/react-table';
import * as React from 'react';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';
import { GooglePlacePickerDialog } from '@/components/admin/google-place-picker-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

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

/** Google Business Profile linkage — separate from the generic
 * AdminResourcePage table below since linking needs an interactive
 * search widget (Places Autocomplete), not a plain form field. */
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
    <Card className="rounded-card">
      <CardHeader>
        <h2 className="text-h4 text-foreground font-semibold">Google Business Profile</h2>
        <p className="text-caption text-muted-foreground">
          Link each outlet to its real Google Maps listing — powers the review carousel shown on the
          homepage and product pages.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
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
            <GooglePlacePickerDialog
              outletId={outlet.id}
              outletName={outlet.name}
              onLinked={load}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Ch.16 §96 Outlet Management API. */
export default function OutletsPage() {
  return (
    <div className="space-y-6">
      <GoogleBusinessSection />
      <AdminResourcePage
        title="Outlets"
        singularLabel="Outlet"
        description="Physical stores, delivery radius, and working hours. Exact coordinates come from linking Google Business Profile above, not manual entry."
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
        ]}
      />
    </div>
  );
}
