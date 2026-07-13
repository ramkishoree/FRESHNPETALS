'use client';

import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { LoadingState } from '@/components/states/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ColumnDef } from '@tanstack/react-table';

interface StaticPageRow extends Record<string, unknown> {
  id: string;
  title: string;
  slug: string;
  status: string;
}

const STATUS_VARIANT: Record<string, string> = {
  draft: 'text-muted-foreground',
  published: 'text-success-text',
  archived: 'text-muted-foreground',
};

const columns: ColumnDef<StaticPageRow>[] = [
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'slug', header: 'Slug' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant="outline" className={STATUS_VARIANT[row.original.status]}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const path = row.original.slug === 'home' ? '/' : `/${row.original.slug}`;
      return (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" asChild>
            <a
              href={`/api/draft/enable?path=${encodeURIComponent(path)}`}
              target="_blank"
              rel="noreferrer"
            >
              Preview
            </a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/pages/${row.original.id}`}>Edit</Link>
          </Button>
        </div>
      );
    },
  },
];

/**
 * Bespoke, not the generic AdminResourcePage — its single-dialog JSON
 * field was exactly the "too technical" complaint (owner just wants to
 * edit text and replace pictures). Homepage/About/Contact/Privacy/Terms/
 * FAQ/Delivery Policy are a fixed set of pages seeded by migration, not
 * freely creatable, so this is edit-only: click a row to open the plain-
 * text editor at /admin/pages/[id].
 */
export default function StaticPagesPage() {
  const [rows, setRows] = React.useState<StaticPageRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void (async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/v1/admin/pages?limit=100');
        const body = await response.json();
        if (!response.ok || !body.success)
          throw new Error(body.error?.message ?? 'Failed to load pages.');
        setRows(body.data.items as StaticPageRow[]);
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : 'Failed to load pages.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2 text-foreground font-bold">Pages</h1>
        <p className="text-body text-muted-foreground">
          Homepage, About, Contact, Privacy, Terms, FAQ, Delivery Policy. Click a page to edit its
          text and pictures.
        </p>
      </div>
      {isLoading ? <LoadingState /> : <DataTable columns={columns} data={rows} />}
    </div>
  );
}
