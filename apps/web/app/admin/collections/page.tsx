'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';
import { Badge } from '@/components/ui/badge';

interface CollectionRow extends Record<string, unknown> {
  id: string;
  name: string;
  slug: string;
  is_featured: boolean;
}

const columns: ColumnDef<CollectionRow>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'slug', header: 'Slug' },
  {
    accessorKey: 'is_featured',
    header: 'Featured',
    cell: ({ row }) =>
      row.original.is_featured ? <Badge variant="outline">Featured</Badge> : null,
  },
];

/** Ch.16 §101 Collection Management API. */
export default function CollectionsPage() {
  return (
    <AdminResourcePage
      title="Collections"
      singularLabel="Collection"
      description="Manual, seasonal, and festival collections."
      endpoint="/api/v1/admin/collections"
      columns={columns}
      searchPlaceholder="Search collections..."
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'slug', label: 'Slug', type: 'text', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'hero_image', label: 'Hero image', type: 'image' },
        { name: 'is_featured', label: 'Featured', type: 'boolean' },
        { name: 'starts_at', label: 'Starts at', type: 'datetime' },
        { name: 'ends_at', label: 'Ends at', type: 'datetime' },
      ]}
    />
  );
}
