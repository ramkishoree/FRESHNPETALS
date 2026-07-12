'use client';

import type { ColumnDef } from '@tanstack/react-table';
import * as React from 'react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import { LoadingState } from '@/components/states/loading-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { AdminResourceField } from './admin-resource-field';

type ResourceRow = Record<string, unknown> & { id: string };

export interface AdminResourcePageProps<TRow extends ResourceRow> {
  title: string;
  /** Singular form for dialog titles/buttons — plural-to-singular isn't a regex problem (Categories -> Category, not "Categorie"). */
  singularLabel: string;
  description?: string;
  endpoint: string;
  columns: ColumnDef<TRow>[];
  fields: AdminResourceField[];
  searchPlaceholder?: string;
  /** When provided, adds a "Preview" action per row (opens the real storefront page in Draft Mode). Return null to hide it for that row. */
  getPreviewHref?: (row: TRow) => string | null;
}

/**
 * The client-side counterpart to server/http/admin-crud-route.ts — one
 * list+create+edit+delete UI behind every structurally-uniform admin
 * resource (Ch.16 §100-106), generated from a field config instead of a
 * dozen hand-built forms. Products/Inventory/Orders get bespoke pages —
 * they have real workflows (wizards, state machines) this generic shape
 * would flatten, not simplify.
 */
export function AdminResourcePage<TRow extends ResourceRow>({
  title,
  singularLabel,
  description,
  endpoint,
  columns,
  fields,
  searchPlaceholder,
  getPreviewHref,
}: AdminResourcePageProps<TRow>) {
  const [rows, setRows] = React.useState<TRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TRow | null>(null);
  const [formValues, setFormValues] = React.useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${endpoint}?limit=100`);
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? 'Failed to load.');
      setRows(body.data.items as TRow[]);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to load.');
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  React.useEffect(() => {
    // Standard fetch-on-mount idiom (React docs "Fetching data" pattern);
    // `load`'s own deps gate re-runs, so this doesn't cascade — the
    // compiler's static check can't see that through the async indirection.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setFormValues({});
    setDialogOpen(true);
  }

  function openEdit(row: TRow) {
    setEditing(row);
    setFormValues({ ...row });
    setDialogOpen(true);
  }

  async function handleDelete(row: TRow) {
    try {
      const response = await fetch(`${endpoint}/${row.id}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to delete.');
      toast.success('Deleted.');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to delete.');
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const url = editing ? `${endpoint}/${editing.id}` : endpoint;
      const method = editing ? 'PATCH' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? 'Failed to save.');
      toast.success(editing ? 'Updated.' : 'Created.');
      setDialogOpen(false);
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  }

  const columnsWithActions: ColumnDef<TRow>[] = [
    ...columns,
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const previewHref = getPreviewHref?.(row.original);
        return (
          <div className="flex justify-end gap-2">
            {previewHref && (
              <Button variant="ghost" size="sm" asChild>
                <a
                  href={`/api/draft/enable?path=${encodeURIComponent(previewHref)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Preview
                </a>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
              Edit
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
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 text-foreground font-bold">{title}</h1>
          {description && <p className="text-body text-muted-foreground">{description}</p>}
        </div>
        <Button onClick={openCreate}>Add {singularLabel}</Button>
      </div>

      {isLoading ? (
        <LoadingState variant="table-rows" count={5} />
      ) : (
        <DataTable
          columns={columnsWithActions}
          data={rows}
          {...(searchPlaceholder ? { searchPlaceholder } : {})}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editing ? `Edit ${singularLabel}` : `Add ${singularLabel}`}
              </DialogTitle>
              <DialogDescription>Fields marked required must be filled in.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {fields.map((field) => (
                <div key={field.name} className="grid gap-1.5">
                  <Label htmlFor={field.name}>
                    {field.label}
                    {field.required && ' *'}
                  </Label>
                  <FieldInput
                    field={field}
                    value={formValues[field.name]}
                    onChange={(value) =>
                      setFormValues((prev) => ({ ...prev, [field.name]: value }))
                    }
                  />
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Raw-JSON editor for jsonb columns the generic field system has no
 * typed sub-form for (offers.conditions/reward — freeform by design,
 * used differently per offer_type). Only commits to the parent's
 * formValues once the typed text actually parses; an in-progress edit
 * that's momentarily invalid JSON doesn't wipe out the last-known-good
 * value or submit garbage.
 */
function JsonFieldInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [text, setText] = React.useState(() => JSON.stringify(value ?? {}, null, 2));
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Textarea
        id={id}
        value={text}
        rows={6}
        className="font-mono text-xs"
        onChange={(event) => {
          const raw = event.target.value;
          setText(raw);
          try {
            onChange(raw.trim() === '' ? {} : JSON.parse(raw));
            setError(null);
          } catch {
            setError('Not valid JSON yet — keep typing.');
          }
        }}
      />
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: AdminResourceField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (field.type) {
    case 'boolean':
      return <Switch checked={Boolean(value)} onCheckedChange={onChange} />;
    case 'textarea':
      return (
        <Textarea
          id={field.name}
          value={(value as string) ?? ''}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case 'number':
      return (
        <Input
          id={field.name}
          type="number"
          value={(value as number) ?? ''}
          placeholder={field.placeholder}
          onChange={(event) =>
            onChange(event.target.value === '' ? undefined : Number(event.target.value))
          }
        />
      );
    case 'select':
      return (
        <Select value={(value as string) ?? ''} onValueChange={onChange}>
          <SelectTrigger id={field.name}>
            <SelectValue placeholder={field.placeholder ?? 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'datetime':
      return (
        <Input
          id={field.name}
          type="datetime-local"
          value={(value as string) ?? ''}
          onChange={(event) =>
            onChange(event.target.value ? new Date(event.target.value).toISOString() : undefined)
          }
        />
      );
    case 'json':
      return <JsonFieldInput id={field.name} value={value} onChange={onChange} />;
    case 'image':
      return (
        <ImageUploadField id={field.name} value={(value as string) ?? ''} onChange={onChange} />
      );
    default:
      return (
        <Input
          id={field.name}
          value={(value as string) ?? ''}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}
