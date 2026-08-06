import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Package,
  Percent,
  Settings,
  ShoppingCart,
  Star,
  Store,
  Tags,
  Ticket,
  Truck,
  Users,
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
  { label: 'Customers', href: '/admin/customers', icon: Users, description: 'Who buys from you' },
  {
    label: 'Delivery slots',
    href: '/admin/delivery-slots',
    icon: Truck,
    description: 'Times you deliver',
  },
  { label: 'Coupons', href: '/admin/coupons', icon: Ticket, description: 'Discount codes' },
  { label: 'Offers', href: '/admin/offers', icon: Percent, description: 'Automatic promotions' },
  { label: 'Reviews', href: '/admin/reviews', icon: Star, description: 'Approve what shows' },
  {
    label: 'Announcements',
    href: '/admin/announcements',
    icon: Megaphone,
    description: 'Banner across the site',
  },
  {
    label: 'Collections',
    href: '/admin/collections',
    icon: ClipboardList,
    description: 'Curated groupings',
  },
  {
    label: 'Marketing',
    href: '/admin/marketing',
    icon: MessageSquare,
    description: 'Campaigns',
  },
  { label: 'Traffic', href: '/admin/traffic', icon: BarChart3, description: 'Visitors and views' },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    description: 'Business details',
  },
  {
    label: 'Audit log',
    href: '/admin/audit',
    icon: ClipboardList,
    description: 'Who changed what',
  },
] as const;

/** Everything except Dashboard itself — what the dashboard renders as tiles. */
export const ADMIN_DASHBOARD_TILES = ADMIN_NAV.filter((item) => item.href !== '/admin');
