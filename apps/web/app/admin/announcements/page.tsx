'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';
import { Badge } from '@/components/ui/badge';

interface AnnouncementRow extends Record<string, unknown> {
  id: string;
  title: string | null;
  message: string;
  enabled: boolean;
  priority: number;
}

const columns: ColumnDef<AnnouncementRow>[] = [
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'message', header: 'Message' },
  { accessorKey: 'priority', header: 'Priority' },
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

/** Ch.6 Announcement Management — banner text, scheduling, expiry. */
export default function AnnouncementsPage() {
  return (
    <AdminResourcePage
      title="Announcements"
      singularLabel="Announcement"
      description="Site-wide banners (e.g. 'Free delivery above ₹999')."
      endpoint="/api/v1/admin/announcements"
      columns={columns}
      fields={[
        { name: 'title', label: 'Title', type: 'text' },
        { name: 'message', label: 'Message', type: 'textarea', required: true },
        { name: 'button_text', label: 'Button text', type: 'text' },
        { name: 'button_url', label: 'Button URL', type: 'text' },
        {
          name: 'background_color',
          label: 'Background color',
          type: 'text',
          placeholder: '#0f8a54',
        },
        { name: 'text_color', label: 'Text color', type: 'text', placeholder: '#ffffff' },
        { name: 'start_date', label: 'Start date', type: 'datetime' },
        { name: 'end_date', label: 'End date', type: 'datetime' },
        { name: 'priority', label: 'Priority', type: 'number' },
        { name: 'dismissible', label: 'Dismissible', type: 'boolean' },
        { name: 'enabled', label: 'Enabled', type: 'boolean' },
      ]}
    />
  );
}
