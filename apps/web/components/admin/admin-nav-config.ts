import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Megaphone, Settings, ShoppingCart, Store } from 'lucide-react';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: { label: string; href: string }[];
}

/**
 * Ch.12 §43 Sidebar. Owner's explicit "very simple and easy to use" call:
 * Inventory and Outlets folded into the Products tab itself (stock/price/
 * photo per outlet lives on each product's page, store-location records
 * live in a collapsed panel there — see product-outlet-overrides.tsx and
 * outlet-management-panel.tsx). Media Library removed (uploads happen
 * inline everywhere they're needed, a separate browsing page added
 * nothing). Support Inbox removed (support moved fully to WhatsApp).
 * Users & roles removed (those are sensitive enough to manage directly
 * in the Supabase dashboard, not duplicate here).
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
    href: '/admin/blogs',
    icon: Megaphone,
    children: [
      { label: 'Blogs', href: '/admin/blogs' },
      { label: 'Pages', href: '/admin/pages' },
      { label: 'Announcements', href: '/admin/announcements' },
    ],
  },
  {
    label: 'Admin',
    href: '/admin/settings',
    icon: Settings,
    children: [
      { label: 'Settings', href: '/admin/settings' },
      { label: 'Audit log', href: '/admin/audit' },
    ],
  },
] as const;
