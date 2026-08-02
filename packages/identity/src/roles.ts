/**
 * Mirrors infrastructure/database/migrations/0004 (roles) and 0017 (seeded
 * permissions). Keep in sync manually — there's no codegen from SQL yet.
 */

export const ROLES = ['anonymous', 'customer', 'administrator', 'owner'] as const;
export type Role = (typeof ROLES)[number];

export const ADMIN_ROLES: readonly Role[] = ['administrator', 'owner'];

export const PERMISSIONS = [
  'products.read',
  'products.create',
  'products.update',
  'products.publish',
  'products.delete',
  'orders.read',
  'orders.update',
  'inventory.update',
  'coupons.create',
  'offers.publish',
  'users.manage',
  'roles.manage',
  'settings.manage',
  'ai.execute',
  'ai.approve',
  'system.deploy',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Ch.10 §33/§80: administrator and owner both get full access — no
 * data-level distinction. Mirrors the SQL `private.is_admin()` function. */
export function isAdminRole(role: Role | null | undefined): boolean {
  return role != null && ADMIN_ROLES.includes(role);
}

export function hasPermission(
  userPermissions: readonly Permission[],
  required: Permission,
): boolean {
  return userPermissions.includes(required);
}
