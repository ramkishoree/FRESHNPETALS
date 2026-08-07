import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Megaphone,
  Package,
  Percent,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  Ticket,
  Truck,
} from 'lucide-react';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** One line, shown under the label on the dashboard tiles. */
  description: string;
}

/**
 * Ch.12 §43 Sidebar, and the dashboard tiles — one list, so the two can
 * never disagree about what exists.
 *
 * Trimmed hard at the owner's request: Customers, Reviews, Collections,
 * Marketing, Traffic and Audit log are gone. Each was a tab that had to
 * be scrolled past to reach the handful of things actually used daily.
 * Their data and routes still exist where removing them would break
 * something — reviews now auto-approve rather than piling up unseen.
 *
 * Owner's explicit call: flat, not grouped. The old "Shop / Sales /
 * Marketing / Admin" parents meant everyday destinations like Orders
 * and Customers sat one expand away, and the parent rows went nowhere
 * useful themselves. Every destination is now top-level and reachable
 * in one click from either the sidebar or the dashboard.
 *
 * Outlets earned a place of their own here after being unfindable
 * inside a collapsed panel on the Products page.
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'Everything, one tap away',
  },
  {
    label: 'Orders',
    href: '/admin/orders',
    icon: ShoppingCart,
    description: 'Live and past orders',
  },
  { label: 'Products', href: '/admin/products', icon: Package, description: 'Catalogue and stock' },
  { label: 'Categories', href: '/admin/categories', icon: Tags, description: 'How products group' },
  {
    label: 'Outlets',
    href: '/admin/outlets',
    icon: Store,
    description: 'Stores, radius, Google Business',
  },
  {
    label: 'Delivery slots',
    href: '/admin/delivery-slots',
    icon: Truck,
    description: 'Times and delivery charges',
  },
  { label: 'Coupons', href: '/admin/coupons', icon: Ticket, description: 'Discount codes' },
  {
    label: 'Offers',
    href: '/admin/offers',
    icon: Percent,
    description: 'Banner, poster and badge',
  },
  {
    label: 'Announcements',
    href: '/admin/announcements',
    icon: Megaphone,
    description: 'Banner across the site',
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    description: 'Business name, phone, GST',
  },
] as const;

/** Everything except Dashboard itself — what the dashboard renders as tiles. */
export const ADMIN_DASHBOARD_TILES = ADMIN_NAV.filter((item) => item.href !== '/admin');
