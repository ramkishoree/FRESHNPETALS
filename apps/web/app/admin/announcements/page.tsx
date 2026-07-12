'use client';

import type { ColumnDef } from '@tanstack/react-table';
import * as React from 'react';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';
import { Badge } from '@/components/ui/badge';

interface AnnouncementRow extends Record<string, unknown> {
  id: string;
  title: string | null;
  message: string;
  enabled: boolean;
}

const columns: ColumnDef<AnnouncementRow>[] = [
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'message', header: 'Message' },
  {
    accessorKey: 'enabled',
    header: 'Status',
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={row.original.enabled ? 'text-success-text' : 'text-muted-foreground'}
      >
        {row.original.enabled ? 'Enabled' : 'Disabled'}
      </Badge>
    ),
  },
];

/**
 * Ch.6 Announcement Management, deliberately kept to four fields per
 * owner feedback ("too complex... just Title, Image, Button 1, Button
 * 2 — Button 1 is the offer CTA"). Button 2 is always a fixed "No
 * thanks" dismiss (the existing `dismissible` column, no longer exposed
 * as a separate toggle — every announcement is dismissible). The
 * scheduling/color/custom-button-text fields still exist as columns for
 * a future text-only banner use case, just not surfaced here.
 */
export default function AnnouncementsPage() {
  const [offerOptions, setOfferOptions] = React.useState<{ label: string; value: string }[]>([]);

  React.useEffect(() => {
    void (async () => {
      const response = await fetch('/api/v1/admin/offers?limit=100');
      const body = await response.json();
      if (response.ok && body.success) {
        setOfferOptions(
          (body.data.items as { id: string; name: string }[]).map((offer) => ({
            label: offer.name,
            value: offer.id,
          })),
        );
      }
    })();
  }, []);

  return (
    <AdminResourcePage
      title="Announcements"
      singularLabel="Announcement"
      description="A site-wide promo banner. Button 1 links to the selected offer; Button 2 is always a dismiss."
      endpoint="/api/v1/admin/announcements"
      columns={columns}
      fields={[
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'image_url', label: 'Image', type: 'image' },
        { name: 'message', label: 'Message', type: 'textarea', required: true },
        {
          name: 'offer_id',
          label: 'Button 1 — offer',
          type: 'select',
          placeholder: 'Select an offer',
          options: offerOptions,
        },
        { name: 'enabled', label: 'Enabled', type: 'boolean' },
      ]}
    />
  );
}
