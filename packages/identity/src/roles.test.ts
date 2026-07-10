import { describe, expect, it } from 'vitest';
import { hasPermission, isAdminRole, type Permission } from './roles';

describe('isAdminRole', () => {
  it('is true for administrator and owner', () => {
    expect(isAdminRole('administrator')).toBe(true);
    expect(isAdminRole('owner')).toBe(true);
  });

  it('is false for customer, anonymous, null, and undefined', () => {
    expect(isAdminRole('customer')).toBe(false);
    expect(isAdminRole('anonymous')).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});

describe('hasPermission', () => {
  it('is true when the permission is present', () => {
    const perms: Permission[] = ['products.read', 'orders.read'];
    expect(hasPermission(perms, 'products.read')).toBe(true);
  });

  it('is false when the permission is absent', () => {
    const perms: Permission[] = ['products.read'];
    expect(hasPermission(perms, 'system.deploy')).toBe(false);
  });

  it('is false for an empty permission set', () => {
    expect(hasPermission([], 'products.read')).toBe(false);
  });
});
