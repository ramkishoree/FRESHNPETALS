import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Megaphone, Settings, ShoppingCart, Store } from 'lucide-react';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: { label: string; href: string }[];
}

/**
 * Ch.12 §43 Sidebar, consolidated to 4 top-level groups (plus Dashboard)
 * per the owner's explicit request — the previous 10-row flat list read
 * as clutter even though every one of those pages is genuinely wired.
 * Nothing here was removed; every page below still exists and works,
 * just grouped by what it's actually for rather than listed flat.
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  {
    label: 'Shop',
    href: '/admin/products',
    icon: Store,
    children: [
      { label: 'Products', href: '/admin/products' },
      { label: 'Categories', href: '/admin/categories' },
      { label: 'Collections', href: '/admin/collections' },
      { label: 'Inventory', href: '/admin/inventory' },
      { label: 'Outlets', href: '/admin/outlets' },
    ],
  },
  {
    label: 'Sales',
    href: '/admin/orders',
    icon: ShoppingCart,
    children: [
      { label: 'Orders', href: '/admin/orders' },
      { label: 'Customers', href: '/admin/customers' },
      { label: 'Coupons', href: '/admin/coupons' },
      { label: 'Offers', href: '/admin/offers' },
      { label: 'Reviews', href: '/admin/reviews' },
    ],
  },
  {
    label: 'Marketing',
    href: '/admin/ai',
    icon: Megaphone,
    children: [
      { label: 'AI Workspace', href: '/admin/ai' },
      { label: 'Blogs', href: '/admin/blogs' },
      { label: 'Pages', href: '/admin/pages' },
      { label: 'Media library', href: '/admin/media' },
      { label: 'Announcements', href: '/admin/announcements' },
      { label: 'Support Inbox', href: '/admin/support' },
    ],
  },
  {
    label: 'Admin',
    href: '/admin/settings',
    icon: Settings,
    children: [
      { label: 'Settings', href: '/admin/settings' },
      { label: 'Users & roles', href: '/admin/users' },
      { label: 'Audit log', href: '/admin/audit' },
    ],
  },
] as const;
