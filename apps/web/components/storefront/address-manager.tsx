'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/states/empty-state';
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

interface Address {
  id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string | null;
  postal_code: string;
  is_default: boolean;
}

const EMPTY_FORM = {
  label: '',
  recipientName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
};

export function AddressManager({ initialAddresses }: { initialAddresses: Address[] }) {
  const [addresses, setAddresses] = React.useState(initialAddresses);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = React.useState(false);

  async function reload() {
    const response = await fetch('/api/v1/account/addresses');
    const body = await response.json();
    if (response.ok && body.success) setAddresses(body.data);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch('/api/v1/account/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to save address.');
      toast.success('Address saved.');
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      await reload();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to save address.');
    } finally {
      setIsSaving(false);
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
      <Button onClick={() => setDialogOpen(true)}>Add address</Button>

      {addresses.length === 0 ? (
        <EmptyState title="No saved addresses" description="Add an address to speed up checkout." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <div key={address.id} className="rounded-card border-border space-y-1 border p-4">
              <div className="flex items-center gap-2">
                <p className="text-foreground font-medium">{address.label || 'Address'}</p>
                {address.is_default && <Badge variant="outline">Default</Badge>}
              </div>
              <p className="text-body text-foreground">{address.recipient_name}</p>
              <p className="text-body text-muted-foreground">
                {address.address_line_1}
                {address.address_line_2 ? `, ${address.address_line_2}` : ''}, {address.city}
                {address.state ? `, ${address.state}` : ''} {address.postal_code}
              </p>
              <p className="text-caption text-muted-foreground">{address.phone}</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => handleDelete(address.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add address</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
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
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  required
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="addressLine1">Address</Label>
                <Input
                  id="addressLine1"
                  required
                  value={form.addressLine1}
                  onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    required
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="postalCode">Postal code</Label>
                  <Input
                    id="postalCode"
                    required
                    value={form.postalCode}
                    onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save address'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
