import 'server-only';
import { isAdminRole, type Role } from '@prana/identity';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface CurrentUser {
  id: string;
  email: string | null;
  roles: Role[];
}

/**
 * Resolves the authenticated user's roles via the service-role client
 * rather than their own session client. `roles`/`user_roles` are
 * admin-or-own-row-only under RLS (infrastructure/database/migrations/
 * 0011) — a customer session can't read the `roles` table to translate
 * their own role_id into a name, so this trusted server-side lookup does
 * it instead. Never returns another user's data; `user_roles.user_id` is
 * always scoped to the caller's own id.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data: userRoles } = await admin
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', user.id)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  const roles = (userRoles ?? [])
    .map((row) => (row.roles as unknown as { name: Role } | null)?.name)
    .filter((name): name is Role => name != null);

  return { id: user.id, email: user.email ?? null, roles };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('UNAUTHENTICATED', 'Sign-in required.');
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.roles.some((role) => isAdminRole(role))) {
    throw new AuthError('FORBIDDEN', 'Administrator access required.');
  }
  return user;
}

export class AuthError extends Error {
  constructor(
    public readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN',
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
