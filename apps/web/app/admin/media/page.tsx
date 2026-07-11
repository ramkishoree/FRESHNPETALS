'use client';

import type { ColumnDef } from '@tanstack/react-table';
import * as React from 'react';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';
import { MediaUploadButton } from '@/components/admin/media-upload-button';

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
 * Ch.12 §56 Media Library. Real uploads go through MediaUploadButton →
 * /api/v1/admin/media/upload, which converts every file to WebP
 * server-side before it ever reaches storage. AdminResourcePage's own
 * "Add Asset" dialog stays too, for registering an asset that already
 * exists at a known storage_path (e.g. seeded/migrated content) without
 * re-uploading it.
 */
export default function MediaLibraryPage() {
  // Forces AdminResourcePage to remount (and refetch) after a real
  // upload — it has no exposed refresh() method of its own.
  const [refreshKey, setRefreshKey] = React.useState(0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <MediaUploadButton onUploaded={() => setRefreshKey((k) => k + 1)} />
      </div>
      <AdminResourcePage
        key={refreshKey}
        title="Media"
        singularLabel="Asset"
        description="Every upload is converted to WebP automatically."
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
    </div>
  );
}
