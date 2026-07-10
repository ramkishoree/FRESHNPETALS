'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';

interface MediaRow extends Record<string, unknown> {
  id: string;
  filename: string;
  mime_type: string;
  alt_text: string | null;
}

const columns: ColumnDef<MediaRow>[] = [
  { accessorKey: 'filename', header: 'Filename' },
  { accessorKey: 'mime_type', header: 'Type' },
  { accessorKey: 'alt_text', header: 'Alt text' },
];

/**
 * Ch.12 §56 Media Library. The file bytes go straight to Supabase Storage
 * via a signed upload URL (a direct-to-storage widget, deferred — Phase 9
 * is the first page that actually needs uploads flowing end-to-end); this
 * registers/edits an asset's metadata once a file exists at `storage_path`.
 */
export default function MediaLibraryPage() {
  return (
    <AdminResourcePage
      title="Media"
      singularLabel="Asset"
      description="Registered assets (filename, alt text, tags). Upload flow lands with Phase 9."
      endpoint="/api/v1/admin/media"
      columns={columns}
      searchPlaceholder="Search media..."
      fields={[
        { name: 'filename', label: 'Filename', type: 'text', required: true },
        {
          name: 'mime_type',
          label: 'MIME type',
          type: 'text',
          required: true,
          placeholder: 'image/webp',
        },
        { name: 'storage_path', label: 'Storage path', type: 'text', required: true },
        { name: 'cdn_url', label: 'CDN URL', type: 'text' },
        { name: 'alt_text', label: 'Alt text', type: 'text' },
      ]}
    />
  );
}
