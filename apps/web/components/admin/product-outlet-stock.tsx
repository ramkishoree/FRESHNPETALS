'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OutletRow {
  outletId: string;
  outletName: string;
  physicalQuantity: number;
  availableQuantity: number;
}

/**
 * Owner's explicit call: price, sale price, and photo stay uniform across
 * every outlet (set once above, on the product itself) — stock is the only
 * thing that varies per outlet, so this is the only per-outlet editor left.
 * Keyed on (productId, outletId), not an inventory row id — a brand-new
 * product/outlet pair has no row yet, and the PATCH endpoint creates one on
 * first use rather than requiring it to already exist.
 */
export function ProductOutletStock({ productId }: { productId: string | undefined }) {
  const [rows, setRows] = React.useState<OutletRow[]>([]);
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [savingOutletId, setSavingOutletId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!productId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/admin/products/${productId}/outlets`);
      const body = await response.json();
      if (response.ok && body.success) {
        const items = body.data as OutletRow[];
        setRows(items);
        setEdits(
          Object.fromEntries(items.map((row) => [row.outletId, String(row.physicalQuantity)])),
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount/productId change
    void load();
  }, [load]);

  async function saveStock(row: OutletRow) {
    if (!productId) return;
    const edit = edits[row.outletId];
    if (edit === undefined) return;
    const quantity = Number(edit);
    if (!Number.isFinite(quantity) || quantity === row.physicalQuantity) return;

    setSavingOutletId(row.outletId);
    try {
      const response = await fetch(`/api/v1/admin/products/${productId}/outlets/${row.outletId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error?.message ?? 'Failed to update stock.');
      }
      toast.success(`${row.outletName}: stock set to ${quantity}.`);
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to update stock.');
    } finally {
      setSavingOutletId(null);
    }
  }

  if (!productId) {
    return (
      <p className="text-caption text-muted-foreground">
        Save the product first, then come back here to set stock per outlet.
      </p>
    );
  }

  if (isLoading && rows.length === 0) {
    return <p className="text-caption text-muted-foreground">Loading outlets…</p>;
  }

  if (rows.length === 0) {
    return <p className="text-caption text-muted-foreground">No active outlets yet.</p>;
  }

  return (
    <div className="divide-border border-border divide-y rounded-md border">
      {rows.map((row) => (
        <div key={row.outletId} className="flex items-center justify-between gap-3 p-3">
          <Label className="text-body font-medium" htmlFor={`stock-${row.outletId}`}>
            {row.outletName}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id={`stock-${row.outletId}`}
              type="number"
              min={0}
              className="w-24"
              value={edits[row.outletId] ?? String(row.physicalQuantity)}
              onChange={(e) => setEdits((prev) => ({ ...prev, [row.outletId]: e.target.value }))}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={savingOutletId === row.outletId}
              onClick={() => void saveStock(row)}
            >
              {savingOutletId === row.outletId ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
