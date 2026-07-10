import { AdminShell } from '@/components/admin/admin-shell';
import { signOut } from '@/server/auth/actions';
import { requireAdmin } from '@/server/auth/session';

/**
 * `proxy.ts` already gates `/admin/**` to authenticated administrator/
 * owner sessions (Phase 4). `requireAdmin()` here is defense in depth —
 * the same layer-doesn't-trust-the-layer-above-it discipline the RLS
 * policies already apply at the database boundary.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  async function handleSignOut() {
    'use server';
    await signOut();
  }

  return (
    <AdminShell userEmail={user.email ?? 'Administrator'} onSignOut={handleSignOut}>
      {children}
    </AdminShell>
  );
}
