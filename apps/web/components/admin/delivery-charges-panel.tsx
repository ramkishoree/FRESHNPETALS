'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * The three numbers that decide what a customer pays for delivery.
 *
 * They live in `system_settings` and were previously only reachable from
 * a generic key/value Settings screen — which meant the owner had to
 * know that `delivery_per_km_fee_inr` was the thing to edit. They belong
 * next to the delivery slots, which is the page you are already on when
 * you think about delivery.
 *
 * Same keys `getRateConfig` reads (server/checkout/get-rate-config.ts),
 * so editing here changes checkout immediately.
 */
const FIELDS = [
  {
    key: 'delivery_base_fee_inr',
    label: 'Base delivery fee (₹)',
    hint: 'Charged on every order, before any distance is counted.',
  },
  {
    key: 'delivery_base_km',
    label: 'Distance included (km)',
    hint: 'Covered by the base fee. Only distance beyond this is charged per km.',
  },
  {
    key: 'delivery_per_km_fee_inr',
    label: 'Per km beyond that (₹)',
    hint: 'Added for each kilometre past the included distance.',
  },
  {
    key: 'night_charge_inr',
    label: 'Night delivery charge (₹)',
    hint: 'Flat amount added when a late slot is chosen. Set 0 to switch it off.',
  },
] as const;

export function DeliveryChargesPanel() {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [nightAfter, setNightAfter] = React.useState('20:00');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/admin/settings?limit=100');
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error('Failed to load delivery charges.');
      const next: Record<string, string> = {};
      for (const row of body.data.items as { key: string; value: unknown }[]) {
        if (FIELDS.some((field) => field.key === row.key)) next[row.key] = String(row.value ?? '');
        if (row.key === 'night_charge_after_time' && typeof row.value === 'string') {
          setNightAfter(row.value);
        }
      }
      setValues(next);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to load delivery charges.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save() {
    setIsSaving(true);
    try {
      for (const field of FIELDS) {
        const raw = values[field.key];
        if (raw === undefined || raw === '') continue;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error(`${field.label} must be a number that isn't negative.`);
        }
        const response = await fetch(`/api/v1/admin/settings/${field.key}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: parsed }),
        });
        const body = await response.json();
        if (!response.ok || !body.success) {
          throw new Error(body.error?.message ?? `Failed to save ${field.label}.`);
        }
      }
      // The cutoff is a time, not a number, so it saves separately.
      const cutoffResponse = await fetch('/api/v1/admin/settings/night_charge_after_time', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: nightAfter }),
      });
      const cutoffBody = await cutoffResponse.json();
      if (!cutoffResponse.ok || !cutoffBody.success) {
        throw new Error(cutoffBody.error?.message ?? 'Failed to save the night cutoff.');
      }

      toast.success('Delivery charges updated. Checkout uses them straight away.');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return null;

  return (
    <div className="border-border rounded-card space-y-4 border p-4">
      <div>
        <h2 className="text-h4 text-foreground font-semibold">Delivery charges</h2>
        <p className="text-caption text-muted-foreground">
          A base fee covers the first few kilometres; anything further is charged per km.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {FIELDS.map((field) => (
          <div key={field.key} className="grid gap-1.5">
            <Label htmlFor={field.key}>{field.label}</Label>
            <Input
              id={field.key}
              inputMode="decimal"
              value={values[field.key] ?? ''}
              onChange={(event) =>
                setValues((previous) => ({ ...previous, [field.key]: event.target.value }))
              }
            />
            <p className="text-caption text-muted-foreground">{field.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-1.5 sm:max-w-xs">
        <Label htmlFor="night_charge_after_time">Night charge applies from</Label>
        <Input
          id="night_charge_after_time"
          type="time"
          value={nightAfter}
          onChange={(event) => setNightAfter(event.target.value)}
        />
        <p className="text-caption text-muted-foreground">
          Any delivery slot starting at or after this time counts as a night delivery. The charge is
          on the slot the customer picks, not when they order.
        </p>
      </div>

      <Button onClick={save} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save delivery charges'}
      </Button>
    </div>
  );
}
