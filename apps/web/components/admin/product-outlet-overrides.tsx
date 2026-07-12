'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OutletRow {
  outletId: string;
  outletName: string;
  inventoryId: string | null;
  physicalQuantity: number;
  availableQuantity: number;
  defaultBasePrice: number | null;
  defaultSalePrice: number | null;
  defaultFeaturedImage: string | null;
  basePriceOverride: number | null;
  salePriceOverride: number | null;
  featuredImageOverride: string | null;
}

interface EditState {
  stock: string;
  basePrice: string;
  salePrice: string;
  image: string;
}

function toEditState(row: OutletRow): EditState {
  return {
    stock: String(row.physicalQuantity),
    basePrice: row.basePriceOverride != null ? String(row.basePriceOverride) : '',
    salePrice: row.salePriceOverride != null ? String(row.salePriceOverride) : '',
    image: row.featuredImageOverride ?? '',
  };
}

/**
 * Owner's explicit call: manage stock/price/sale price/photo per outlet
 * from inside the Products tab instead of separate Inventory/Outlets
 * tabs. Every outlet defaults to the product's global price/image
 * (blank fields below) — an outlet only needs its own row in
 * `product_outlet_overrides` once an admin actually types a different
 * value here, matching "simple, minimal effort" for the common case of
 * one outlet or identical pricing everywhere.
 */
export function ProductOutletOverrides({ productId }: { productId: string | undefined }) {
  const [rows, setRows] = React.useState<OutletRow[]>([]);
  const [edits, setEdits] = React.useState<Record<string, EditState>>({});
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
        setEdits(Object.fromEntries(items.map((row) => [row.outletId, toEditState(row)])));
      }
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount/productId change
    void load();
  }, [load]);

  function setEdit(outletId: string, patch: Partial<EditState>) {
    setEdits((prev) => ({ ...prev, [outletId]: { ...prev[outletId]!, ...patch } }));
  }

  async function saveStock(row: OutletRow) {
    if (!productId || !row.inventoryId) return;
    const edit = edits[row.outletId];
    if (!edit) return;
    const newValue = Number(edit.stock);
    const delta = newValue - row.physicalQuantity;
    if (!Number.isFinite(newValue) || delta === 0) return;

    const response = await fetch(`/api/v1/admin/inventory/${row.inventoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionType: 'correction', quantityDelta: delta }),
    });
    const body = await response.json();
    if (!response.ok || !body.success) {
      toast.error(body.error?.message ?? 'Failed to update stock.');
      return;
    }
    toast.success(`${row.outletName}: stock set to ${newValue}.`);
    await load();
  }

  async function savePriceAndImage(row: OutletRow) {
    if (!productId) return;
    const edit = edits[row.outletId];
    if (!edit) return;
    setSavingOutletId(row.outletId);
    try {
      const response = await fetch(`/api/v1/admin/products/${productId}/outlets/${row.outletId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePriceOverride: edit.basePrice ? Number(edit.basePrice) : null,
          salePriceOverride: edit.salePrice ? Number(edit.salePrice) : null,
          featuredImageOverride: edit.image || null,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error?.message ?? 'Failed to save override.');
      }
      toast.success(`${row.outletName}: pricing/photo updated.`);
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to save override.');
    } finally {
      setSavingOutletId(null);
    }
  }

  if (!productId) {
    return (
      <p className="text-caption text-muted-foreground">
        Save the product first, then come back here to set stock or pricing per outlet.
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
      {rows.map((row) => {
        const edit = edits[row.outletId] ?? toEditState(row);
        return (
          <div key={row.outletId} className="space-y-3 p-3">
            <p className="text-body font-medium">{row.outletName}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="grid gap-1">
                <Label className="text-caption">Stock</Label>
                <Input
                  type="number"
                  min={0}
                  value={edit.stock}
                  onChange={(e) => setEdit(row.outletId, { stock: e.target.value })}
                  onBlur={() => void saveStock(row)}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-caption">
                  Price {row.defaultBasePrice != null && `(default ₹${row.defaultBasePrice})`}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Use default"
                  value={edit.basePrice}
                  onChange={(e) => setEdit(row.outletId, { basePrice: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-caption">
                  Sale price {row.defaultSalePrice != null && `(default ₹${row.defaultSalePrice})`}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Use default"
                  value={edit.salePrice}
                  onChange={(e) => setEdit(row.outletId, { salePrice: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-caption">Photo (blank = default)</Label>
                <ImageUploadField
                  id={`outlet-image-${row.outletId}`}
                  value={edit.image}
                  onChange={(url) => setEdit(row.outletId, { image: url })}
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={savingOutletId === row.outletId}
              onClick={() => void savePriceAndImage(row)}
            >
              {savingOutletId === row.outletId ? 'Saving…' : 'Save price & photo'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
