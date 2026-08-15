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

/**
 * Two states, in the only terms that matter to the shop: on sale, or
 * not. Ch.8 §16's editorial pipeline (draft, AI-generated, pending
 * review, approved) offered options like "ai generated" and "pending
 * review" that meant nothing to a florist and, worse, could not reach
 * `published` at all from `draft`.
 *
 * The other statuses still exist in the database for rows that already
 * carry them, so this reads any status but only ever writes these two.
 */
const CHOICES = [
  { value: 'published', label: 'Published — showing on the shop' },
  { value: 'archived', label: 'Archived — hidden from the shop' },
] as const;

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
  // Anything that isn't published is invisible to customers, so every
  // legacy status reads as "hidden" rather than exposing its name.
  const isLive = currentStatus === 'published';
  const options = CHOICES.filter((choice) => choice.value !== currentStatus);

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
      toast.success(
        target === 'published'
          ? 'Published — now showing on the shop.'
          : 'Archived — hidden from the shop.',
      );
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
        <span className={isLive ? 'text-success-text font-medium' : 'text-foreground font-medium'}>
          {isLive ? 'Published' : 'Hidden from the shop'}
        </span>
      </span>
      {options.length > 0 && (
        <>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Change visibility..." />
            </SelectTrigger>
            <SelectContent>
              {options.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
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
