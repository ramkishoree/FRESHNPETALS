'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/states/empty-state';
import { LoadingState } from '@/components/states/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  status: 'active' | 'suspended' | 'deactivated';
  roles: string[];
}

const ROLE_OPTIONS = ['customer', 'administrator', 'owner'] as const;

/** Ch.16 §110 User & Role Management API. */
export default function UsersPage() {
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/admin/users?limit=100');
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? 'Failed to load.');
      setUsers(body.data.items as UserRow[]);
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

  async function setRole(userId: string, role: string) {
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: [role] }),
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to update role.');
      toast.success('Role updated.');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to update role.');
    }
  }

  async function deactivate(userId: string) {
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to deactivate user.');
      toast.success('User deactivated.');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to deactivate user.');
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h2 text-foreground font-bold">Users &amp; roles</h1>
        <p className="text-body text-muted-foreground">
          Grant administrator/owner access and revoke it.
        </p>
      </div>

      {isLoading ? (
        <LoadingState variant="list" count={5} />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="rounded-card border-border flex items-center justify-between gap-3 border p-4"
            >
              <div>
                <p className="text-foreground font-medium">
                  {user.full_name ?? user.email ?? user.id}
                </p>
                <p className="text-caption text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={user.status === 'active' ? 'text-success-text' : 'text-destructive'}
                >
                  {user.status}
                </Badge>
                <Select
                  value={user.roles[0] ?? 'customer'}
                  onValueChange={(role) => setRole(user.id, role)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="destructive" onClick={() => deactivate(user.id)}>
                  Deactivate
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
