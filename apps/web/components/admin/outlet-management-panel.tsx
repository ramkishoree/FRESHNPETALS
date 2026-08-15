'use client';

import type { ColumnDef } from '@tanstack/react-table';
import * as React from 'react';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';
import { GooglePlacePickerDialog } from '@/components/admin/google-place-picker-dialog';
import { toast } from 'sonner';
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
  google_place_query: string | null;
  show_google_reviews: boolean;
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

function GoogleBusinessSection({ reloadKey }: { reloadKey: number }) {
  const [outlets, setOutlets] = React.useState<OutletGoogleStatus[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    const response = await fetch('/api/v1/admin/outlets?limit=100');
    const body = await response.json();
    if (response.ok && body.success) setOutlets(body.data.items as OutletGoogleStatus[]);
    setIsLoading(false);
  }, []);

  /**
   * Which outlet's reviews the storefront shows. Off by default for a
   * newly linked outlet: a link has to be confirmed as genuinely ours
   * before its reviews speak for the brand — a text-search match once
   * pulled in a different florist's reviews entirely.
   */
  async function setShowReviews(outletId: string, show: boolean) {
    // Google returns at most 5 reviews per place, so only one outlet can
    // be the source — switching is a swap, not an independent toggle.
    // Confirming names both shops, because the cost of a silent switch
    // is the wrong branch's reputation on the homepage.
    if (show) {
      const current = outlets.find((o) => o.show_google_reviews && o.id !== outletId);
      const next = outlets.find((o) => o.id === outletId);
      if (
        current &&
        !window.confirm(
          `Show reviews from “${next?.name ?? 'this outlet'}” instead of “${current.name}”?\n\nGoogle only returns 5 reviews per shop, so just one outlet can be the source.`,
        )
      ) {
        return;
      }
    }

    const response = await fetch(`/api/v1/admin/outlets/${outletId}/reviews-source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ show }),
    });
    const body = await response.json();
    if (!response.ok || !body.success) {
      toast.error(body.error?.message ?? 'Could not change the reviews source.');
      return;
    }
    toast.success(show ? 'Reviews source updated.' : 'Reviews hidden for this outlet.');
    await load();
  }

  // `reloadKey` changes whenever the outlets table below is mutated.
  // Without it this list was fetched once on mount and only refetched
  // after a link, so an outlet added in the table never appeared here —
  // reported as "only Gomti Nagar can be linked".
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, reloadKey]);

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
            ) : outlet.google_place_query ? (
              // Saved but not resolvable yet — a new listing takes
              // days-to-weeks to reach Google's Places API. Saying so
              // stops this reading as a failure.
              <p className="text-caption text-muted-foreground">
                Noted: “{outlet.google_place_query}”. Link it here once Google lists the shop.
              </p>
            ) : (
              <p className="text-caption text-muted-foreground">Not linked yet</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {outlet.google_business_name && (
              <label className="text-caption text-foreground flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="reviews-source"
                  checked={outlet.show_google_reviews}
                  // A radio can't be unchecked by clicking it, so the
                  // click handler does the toggling and onChange only
                  // exists to keep React from warning about a controlled
                  // input without one.
                  onChange={() => {}}
                  onClick={() => void setShowReviews(outlet.id, !outlet.show_google_reviews)}
                />
                Show these reviews
              </label>
            )}
            <GooglePlacePickerDialog
              outletId={outlet.id}
              outletName={outlet.name}
              onLinked={load}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Rendered by /admin/outlets. This used to be a collapsed `<details>`
 * at the bottom of the Products page, on the reasoning that store
 * locations rarely change — but "rarely edited" turned out to mean
 * "impossible to find when you do": adding a second outlet and trying
 * to rename or link it was the point at which that bit.
 */
export function OutletManagementPanel() {
  const [reloadKey, setReloadKey] = React.useState(0);

  return (
    <div className="border-border rounded-card border">
      <div className="space-y-6 p-4">
        <GoogleBusinessSection reloadKey={reloadKey} />
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
          onMutated={() => setReloadKey((key) => key + 1)}
        />
      </div>
    </div>
  );
}
