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

/** Ch.8 §16 Product State Machine — only the transitions the diagram draws are offered, matching the backend's canTransitionProductStatus. */
const TRANSITIONS: Record<string, string[]> = {
  draft: ['ai_generated', 'pending_review'],
  ai_generated: ['pending_review', 'published'],
  pending_review: ['approved', 'published'],
  approved: ['published'],
  published: ['archived', 'out_of_stock', 'hidden'],
  out_of_stock: ['published', 'archived'],
  hidden: ['published', 'archived'],
  archived: ['draft'],
};

export function ProductStatusControl({
  productId,
  currentStatus,
}: {
  productId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [target, setTarget] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const options = TRANSITIONS[currentStatus] ?? [];

  async function apply() {
    if (!target) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: target }),
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to update status.');
      toast.success(`Status changed to ${target.replace(/_/g, ' ')}.`);
      setTarget('');
      router.refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to update status.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-caption text-muted-foreground">
        Currently:{' '}
        <span className="text-foreground font-medium">{currentStatus.replace(/_/g, ' ')}</span>
      </span>
      {options.length > 0 && (
        <>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-44">
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
          <Button size="sm" disabled={!target || isSaving} onClick={apply}>
            Apply
          </Button>
        </>
      )}
    </div>
  );
}
