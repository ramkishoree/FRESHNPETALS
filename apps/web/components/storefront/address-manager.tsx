'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/states/empty-state';
import { DeliveryMap, type MapLocation } from '@/components/storefront/delivery-map';
import { Badge } from '@/components/ui/badge';
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

export interface SavedAddress {
  id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  address_line_1: string;
  address_line_2: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  is_default: boolean;
}

const EMPTY_FORM = {
  label: '',
  recipientName: '',
  phone: '',
  flatNo: '',
};

/** The full one-line address as checkout will replay it. */
export function formatSavedAddress(address: SavedAddress): string {
  return [address.address_line_2, address.address_line_1].filter(Boolean).join(', ');
}

/**
 * Ch.16 §73 Address API + Ch.12 §27 Address Selection.
 *
 * Captured the same way checkout captures an address — drop a pin, and
 * Google hands back one formatted string plus lat/lng. That's the whole
 * point of the rework: before this, a saved address had typed city/postal
 * fields that checkout had no way to turn back into a delivery pin, so
 * saving one bought you nothing. Now `latitude`/`longitude` come along
 * for the ride and checkout can restore the pin in one tap.
 */
export function AddressManager({ initialAddresses }: { initialAddresses: SavedAddress[] }) {
  const [addresses, setAddresses] = React.useState(initialAddresses);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [pin, setPin] = React.useState<MapLocation | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  async function reload() {
    const response = await fetch('/api/v1/account/addresses');
    const body = await response.json();
    if (response.ok && body.success) setAddresses(body.data);
  }

  function openDialog() {
    setForm(EMPTY_FORM);
    setPin(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!pin) {
      toast.error('Pin the delivery location on the map first.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/v1/account/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(form.label.trim() ? { label: form.label.trim() } : {}),
          recipientName: form.recipientName,
          phone: form.phone,
          addressLine1: pin.formattedAddress,
          ...(form.flatNo.trim() ? { addressLine2: form.flatNo.trim() } : {}),
          latitude: pin.lat,
          longitude: pin.lng,
          isDefault: addresses.length === 0,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to save address.');
      toast.success('Address saved.');
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setPin(null);
      await reload();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to save address.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      // Only one address can carry the flag, and there's no partial
      // unique index enforcing that — clear the others first.
      await Promise.all(
        addresses
          .filter((address) => address.is_default && address.id !== id)
          .map((address) =>
            fetch(`/api/v1/account/addresses/${address.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isDefault: false }),
            }),
          ),
      );
      const response = await fetch(`/api/v1/account/addresses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to update address.');
      await reload();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to update address.');
    }
  }

  async function handleDelete(id: string) {
    try {
      const response = await fetch(`/api/v1/account/addresses/${id}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to delete address.');
      toast.success('Address removed.');
      await reload();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to delete address.');
    }
  }

  return (
    <div className="space-y-4">
      {addresses.length === 0 ? (
        <EmptyState
          title="No saved addresses"
          description="Save one and it's a single tap at checkout — no re-pinning the map."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <div key={address.id} className="rounded-card border-border space-y-1 border p-4">
              <div className="flex items-center gap-2">
                <p className="text-foreground font-medium">{address.label || 'Address'}</p>
                {address.is_default && <Badge variant="outline">Default</Badge>}
              </div>
              <p className="text-body text-foreground">{address.recipient_name}</p>
              <p className="text-body text-muted-foreground">{formatSavedAddress(address)}</p>
              <p className="text-caption text-muted-foreground">{address.phone}</p>
              {address.latitude == null && (
                <p className="text-caption text-warning-text">
                  No map pin on this address — it can&apos;t be used at checkout. Re-add it to fix.
                </p>
              )}
              <div className="flex gap-1 pt-1">
                {!address.is_default && (
                  <Button variant="ghost" size="sm" onClick={() => handleSetDefault(address.id)}>
                    Make default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => handleDelete(address.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button onClick={openDialog}>Add address</Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add address</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid gap-1.5">
                <Label>Delivery location</Label>
                {/* Mounted only while the dialog is open: Google Maps takes
                    ownership of its container's DOM, so it must not be
                    kept alive across open/close cycles. */}
                <DeliveryMap onLocationChange={setPin} />
                {pin && (
                  <p className="text-caption text-muted-foreground">📍 {pin.formattedAddress}</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="address-label">Label (Home, Office…)</Label>
                <Input
                  id="address-label"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="recipientName">Recipient name</Label>
                <Input
                  id="recipientName"
                  required
                  value={form.recipientName}
                  onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="address-phone">Phone</Label>
                <Input
                  id="address-phone"
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="address-flat">Flat / house no. (optional)</Label>
                <Input
                  id="address-flat"
                  value={form.flatNo}
                  onChange={(e) => setForm((f) => ({ ...f, flatNo: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !pin}>
                {isSaving ? 'Saving...' : 'Save address'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
