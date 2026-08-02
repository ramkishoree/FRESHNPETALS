'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Ch.16 §72 Customer Profile API — the name half of it. Owner's explicit
 * call for the revamp: My Account changes your name and manages saved
 * addresses, nothing more. Phone is included because it's what the
 * delivery rider actually calls, and it was already editable through the
 * same PATCH endpoint.
 */
export function ProfileForm({
  initialFirstName,
  initialLastName,
  initialPhone,
  email,
}: {
  initialFirstName: string;
  initialLastName: string;
  initialPhone: string;
  email: string | null;
}) {
  const [firstName, setFirstName] = React.useState(initialFirstName);
  const [lastName, setLastName] = React.useState(initialLastName);
  const [phone, setPhone] = React.useState(initialPhone);
  const [isSaving, setIsSaving] = React.useState(false);

  const isDirty =
    firstName !== initialFirstName || lastName !== initialLastName || phone !== initialPhone;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch('/api/v1/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to save your details.');
      toast.success('Saved.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to save your details.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="profile-first-name">First name</Label>
          <Input
            id="profile-first-name"
            autoComplete="given-name"
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="profile-last-name">Last name</Label>
          <Input
            id="profile-last-name"
            autoComplete="family-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="profile-phone">Phone</Label>
          <Input
            id="profile-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="profile-email">Email</Label>
          {/* Read-only: the email is the Supabase auth identity, changing
              it means a re-verification flow this page doesn't own. */}
          <Input id="profile-email" value={email ?? ''} disabled readOnly />
        </div>
      </div>

      <Button type="submit" disabled={isSaving || !isDirty}>
        {isSaving ? 'Saving...' : 'Save changes'}
      </Button>
    </form>
  );
}
