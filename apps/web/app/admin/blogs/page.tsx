'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';
import { Badge } from '@/components/ui/badge';

interface BlogRow extends Record<string, unknown> {
  id: string;
  title: string;
  slug: string;
  status: string;
}

const STATUS_VARIANT: Record<string, string> = {
  draft: 'text-muted-foreground',
  review: 'text-warning-text',
  scheduled: 'text-info-text',
  published: 'text-success-text',
  archived: 'text-muted-foreground',
};

const columns: ColumnDef<BlogRow>[] = [
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'slug', header: 'Slug' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant="outline" className={STATUS_VARIANT[row.original.status] ?? ''}>
        {row.original.status}
      </Badge>
    ),
  },
];

/** Ch.16 §104 Blog Management API + Ch.12 §51 Blog Module. */
export default function BlogsPage() {
  return (
    <AdminResourcePage
      title="Blogs"
      singularLabel="Blog post"
      description="Articles — draft through published."
      endpoint="/api/v1/admin/blogs"
      columns={columns}
      searchPlaceholder="Search blog posts..."
      getPreviewHref={(row) => `/blog/${row.slug}`}
      fields={[
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'slug', label: 'Slug', type: 'text', required: true },
        { name: 'excerpt', label: 'Excerpt', type: 'textarea' },
        { name: 'featured_image', label: 'Featured image', type: 'image' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Review', value: 'review' },
            { label: 'Scheduled', value: 'scheduled' },
            { label: 'Published', value: 'published' },
            { label: 'Archived', value: 'archived' },
          ],
        },
      ]}
    />
  );
}
