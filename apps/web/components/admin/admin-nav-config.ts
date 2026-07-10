import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  FileText,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: { label: string; href: string }[];
}

/**
 * Ch.12 §43 Sidebar list, expanded with Ch.6 §Administrator Navigation's
 * fuller module set as sub-items (Ch.12 §58: "Avoid deep nesting. Maximum
 * 3 levels" — this is 2). AI Assistant/Automation Center point at stub
 * pages: Phase 11 builds the agents behind them, this phase only builds
 * the shell so the nav item isn't a dead link.
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  {
    label: 'Orders',
    href: '/admin/orders',
    icon: ShoppingCart,
  },
  {
    label: 'Products',
    href: '/admin/products',
    icon: Package,
    children: [
      { label: 'All products', href: '/admin/products' },
      { label: 'Categories', href: '/admin/categories' },
      { label: 'Collections', href: '/admin/collections' },
    ],
  },
  { label: 'Inventory', href: '/admin/inventory', icon: Boxes },
  { label: 'Customers', href: '/admin/customers', icon: Users },
  {
    label: 'Marketing',
    href: '/admin/coupons',
    icon: Megaphone,
    children: [
      { label: 'Coupons', href: '/admin/coupons' },
      { label: 'Offers', href: '/admin/offers' },
      { label: 'Announcements', href: '/admin/announcements' },
    ],
  },
  {
    label: 'Content',
    href: '/admin/blogs',
    icon: FileText,
    children: [
      { label: 'Blogs', href: '/admin/blogs' },
      { label: 'Pages', href: '/admin/pages' },
      { label: 'Media library', href: '/admin/media' },
      { label: 'Reviews', href: '/admin/reviews' },
    ],
  },
  { label: 'Outlets', href: '/admin/outlets', icon: Store },
  { label: 'AI Workspace', href: '/admin/ai', icon: Sparkles },
  { label: 'Support Inbox', href: '/admin/support', icon: MessageCircle },
  {
    label: 'Security',
    href: '/admin/audit',
    icon: ShieldCheck,
    children: [
      { label: 'Audit log', href: '/admin/audit' },
      { label: 'Users & roles', href: '/admin/users' },
    ],
  },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
] as const;
