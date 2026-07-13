'use client';

import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { LoadingState } from '@/components/states/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ColumnDef } from '@tanstack/react-table';

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

/**
 * Bespoke, not the generic AdminResourcePage — blog posts have a real
 * workflow (write content in the block editor at /admin/blogs/[id]) the
 * generic single-dialog field editor can't represent, same reasoning
 * the admin already applies to Products.
 */
export default function BlogsPage() {
  const [rows, setRows] = React.useState<BlogRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/admin/blogs?limit=100');
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? 'Failed to load.');
      setRows(body.data.items as BlogRow[]);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to load.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleDelete(row: BlogRow) {
    try {
      const response = await fetch(`/api/v1/admin/blogs/${row.id}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to delete.');
      toast.success('Deleted.');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to delete.');
    }
  }

  const columns: ColumnDef<BlogRow>[] = [
    { accessorKey: 'title', header: 'Title' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="outline" className={STATUS_VARIANT[row.original.status] ?? ''}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" asChild>
            <a
              href={`/api/draft/enable?path=${encodeURIComponent(`/blog/${row.original.slug}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Preview
            </a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/blogs/${row.original.id}`}>Edit</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => handleDelete(row.original)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 text-foreground font-bold">Blogs</h1>
          <p className="text-body text-muted-foreground">Articles — draft through published.</p>
        </div>
        <Button asChild>
          <Link href="/admin/blogs/new">New post</Link>
        </Button>
      </div>

      {isLoading ? (
        <LoadingState variant="table-rows" count={5} />
      ) : (
        <DataTable columns={columns} data={rows} searchPlaceholder="Search blog posts..." />
      )}
    </div>
  );
}
