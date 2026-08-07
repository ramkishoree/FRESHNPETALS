'use client';

import type { ColumnDef } from '@tanstack/react-table';
import * as React from 'react';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';
import { Badge } from '@/components/ui/badge';

interface AnnouncementRow extends Record<string, unknown> {
  id: string;
  message: string;
  enabled: boolean;
}

const columns: ColumnDef<AnnouncementRow>[] = [
  { accessorKey: 'message', header: 'Banner text' },
  {
    accessorKey: 'enabled',
    header: 'Status',
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={row.original.enabled ? 'text-success-text' : 'text-muted-foreground'}
      >
        {row.original.enabled ? 'Showing' : 'Hidden'}
      </Badge>
    ),
  },
];

/**
 * Ch.6 Announcement Management, reduced to one field.
 *
 * It previously asked for a title, an image, a message and an offer to
 * link a button to. The owner's call: the banner is a sentence on a
 * green strip — "no need for button and all, no image and all, only
 * green background white text". Colour and layout are fixed in the
 * component rather than configured, so there is nothing to get wrong.
 *
 * The title/image/button/colour columns still exist in the table (older
 * rows have data in them); they are simply no longer editable or read.
 */
export function AnnouncementsPageContent() {
  return (
    <AdminResourcePage
      title="Announcements"
      singularLabel="Announcement"
      description="One line across the top of every page. Green background, white text — nothing to configure."
      endpoint="/api/v1/admin/announcements"
      columns={columns}
      fields={[
        {
          name: 'message',
          label: 'Banner text',
          type: 'textarea',
          required: true,
          placeholder: 'Free delivery across Lucknow this weekend',
          helperText: 'Type it and it appears. No image, no buttons, no colours to pick.',
        },
        { name: 'enabled', label: 'Show on the site', type: 'boolean' },
      ]}
    />
  );
}
