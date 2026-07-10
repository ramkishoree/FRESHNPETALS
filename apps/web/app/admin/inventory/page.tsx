'use client';

import type { ColumnDef } from '@tanstack/react-table';
import * as React from 'react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { LoadingState } from '@/components/states/loading-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { Textarea } from '@/components/ui/textarea';

interface InventoryRow {
  id: string;
  productId: string;
  outletId: string;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  criticalThreshold: number;
}

type TransactionType = 'stock_added' | 'damage' | 'correction';

/** Ch.12 §49 Inventory Module + Ch.16 §95 Inventory Management API. */
export default function InventoryPage() {
  const [rows, setRows] = React.useState<InventoryRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dialogRow, setDialogRow] = React.useState<InventoryRow | null>(null);
  const [transactionType, setTransactionType] = React.useState<TransactionType>('stock_added');
  const [quantity, setQuantity] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/admin/inventory?limit=100');
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? 'Failed to load.');
      setRows(body.data.items as InventoryRow[]);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to load.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // Standard fetch-on-mount idiom (React docs "Fetching data" pattern);
    // `load`'s own deps gate re-runs, so this doesn't cascade — the
    // compiler's static check can't see that through the async indirection.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function openAdjust(row: InventoryRow) {
    setDialogRow(row);
    setTransactionType('stock_added');
    setQuantity('');
    setReason('');
  }

  async function submitAdjustment(event: React.FormEvent) {
    event.preventDefault();
    if (!dialogRow) return;
    setIsSaving(true);
    try {
      const magnitude = Math.abs(Number(quantity));
      const quantityDelta = transactionType === 'stock_added' ? magnitude : -magnitude;
      const response = await fetch(`/api/v1/admin/inventory/${dialogRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionType, quantityDelta, reason: reason || undefined }),
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to adjust inventory.');
      toast.success('Inventory adjusted.');
      setDialogRow(null);
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to adjust inventory.');
    } finally {
      setIsSaving(false);
    }
  }

  const columns: ColumnDef<InventoryRow>[] = [
    { accessorKey: 'productId', header: 'Product ID' },
    { accessorKey: 'outletId', header: 'Outlet ID' },
    { accessorKey: 'physicalQuantity', header: 'Physical' },
    { accessorKey: 'reservedQuantity', header: 'Reserved' },
    {
      accessorKey: 'availableQuantity',
      header: 'Available',
      cell: ({ row }) => {
        const { availableQuantity, criticalThreshold, lowStockThreshold } = row.original;
        const tone =
          availableQuantity <= criticalThreshold
            ? 'text-destructive font-semibold'
            : availableQuantity <= lowStockThreshold
              ? 'text-warning-text font-semibold'
              : 'text-foreground';
        return <span className={tone}>{availableQuantity}</span>;
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => openAdjust(row.original)}>
          Adjust
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h2 text-foreground font-bold">Inventory</h1>
        <p className="text-body text-muted-foreground">
          Stock levels across outlets, adjusted with an audited reason.
        </p>
      </div>

      {isLoading ? (
        <LoadingState variant="table-rows" count={6} />
      ) : (
        <DataTable columns={columns} data={rows} />
      )}

      <Dialog open={dialogRow != null} onOpenChange={(open) => !open && setDialogRow(null)}>
        <DialogContent>
          <form onSubmit={submitAdjustment}>
            <DialogHeader>
              <DialogTitle>Adjust inventory</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-1.5">
                <Label>Transaction type</Label>
                <Select
                  value={transactionType}
                  onValueChange={(v) => setTransactionType(v as TransactionType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock_added">Stock added</SelectItem>
                    <SelectItem value="damage">Damage</SelectItem>
                    <SelectItem value="correction">Manual correction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="reason">Reason {transactionType === 'damage' && '*'}</Label>
                <Textarea
                  id="reason"
                  required={transactionType === 'damage'}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogRow(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Apply'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
