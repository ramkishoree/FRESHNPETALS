'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/** Ch.8 §105 Order State Machine — mirrors packages/commerce's ORDER_STATUS_TRANSITIONS. */
const TRANSITIONS: Record<string, string[]> = {
  pending_payment: ['paid', 'failed'],
  paid: ['confirmed', 'refunded'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready'],
  ready: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
  failed: [],
  refunded: [],
};

export function OrderStatusControl({
  orderId,
  currentStatus,
  initialNotes,
}: {
  orderId: string;
  currentStatus: string;
  initialNotes: string;
}) {
  const router = useRouter();
  const [target, setTarget] = React.useState('');
  const [notes, setNotes] = React.useState(initialNotes);
  const [isSaving, setIsSaving] = React.useState(false);
  const options = TRANSITIONS[currentStatus] ?? [];

  async function patch(body: Record<string, unknown>, successMessage: string) {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const responseBody = await response.json();
      if (!response.ok || !responseBody.success) {
        throw new Error(responseBody.error?.message ?? 'Failed to update order.');
      }
      toast.success(successMessage);
      router.refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to update order.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-card border-border space-y-4 border p-4">
      {options.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Move to..." />
            </SelectTrigger>
            <SelectContent>
              {options.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!target || isSaving}
            onClick={() => {
              void patch({ status: target }, `Status changed to ${target.replace(/_/g, ' ')}.`);
              setTarget('');
            }}
          >
            Apply
          </Button>
        </div>
      )}

      <div className="grid gap-1.5">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes (not visible to the customer)"
          rows={3}
        />
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          disabled={isSaving}
          onClick={() => patch({ notes }, 'Notes saved.')}
        >
          Save notes
        </Button>
      </div>
    </div>
  );
}
