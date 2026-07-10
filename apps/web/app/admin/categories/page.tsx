'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { AdminResourcePage } from '@/components/admin/admin-resource-page';
import { Badge } from '@/components/ui/badge';

interface CategoryRow extends Record<string, unknown> {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
}

const columns: ColumnDef<CategoryRow>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'slug', header: 'Slug' },
  { accessorKey: 'sort_order', header: 'Order' },
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

/** Ch.16 §100 Category Management API + Ch.12 §47 Product Module's category filter. */
export default function CategoriesPage() {
  return (
    <AdminResourcePage
      title="Categories"
      singularLabel="Category"
      description="Product categories, hierarchy, and visibility."
      endpoint="/api/v1/admin/categories"
      columns={columns}
      searchPlaceholder="Search categories..."
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true },
        {
          name: 'slug',
          label: 'Slug',
          type: 'text',
          required: true,
          placeholder: 'birthday-flowers',
        },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'sort_order', label: 'Sort order', type: 'number' },
        { name: 'is_active', label: 'Active', type: 'boolean' },
      ]}
    />
  );
}
