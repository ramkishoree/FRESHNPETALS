'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';
import { Badge } from '@/components/ui/badge';

interface StaticPageRow extends Record<string, unknown> {
  id: string;
  title: string;
  slug: string;
  status: string;
}

const columns: ColumnDef<StaticPageRow>[] = [
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'slug', header: 'Slug' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={
          row.original.status === 'published' ? 'text-success-text' : 'text-muted-foreground'
        }
      >
        {row.original.status}
      </Badge>
    ),
  },
];

/** Ch.16 §105 CMS Management API — Homepage/About/Contact/Privacy/Terms/FAQ/Delivery Policy. */
export default function StaticPagesPage() {
  return (
    <AdminResourcePage
      title="Pages"
      singularLabel="Page"
      description="Homepage, About, Contact, Privacy, Terms, FAQ, Delivery Policy."
      endpoint="/api/v1/admin/pages"
      columns={columns}
      searchPlaceholder="Search pages..."
      getPreviewHref={(row) => (row.slug === 'home' ? '/' : `/${row.slug}`)}
      fields={[
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'slug', label: 'Slug', type: 'text', required: true },
        {
          name: 'content',
          label: 'Body content',
          type: 'json',
          placeholder: '{"blocks":[{"type":"paragraph","text":"..."}]}',
        },
        { name: 'layout', label: 'Layout', type: 'text' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Published', value: 'published' },
            { label: 'Archived', value: 'archived' },
          ],
        },
      ]}
    />
  );
}
