'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ADMIN_NAV } from './admin-nav-config';

function isActive(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
}

/** Ch.12 §43 Sidebar. Desktop: fixed column. Mobile: rendered inside a Sheet by AdminTopbar (Ch.12 §61: "Sidebar becomes Drawer"). */
export function AdminSidebar({ onNavigate = () => {} }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3" aria-label="Admin navigation">
      <Link href="/admin" className="mb-4 flex items-center gap-2 px-2 py-1" onClick={onNavigate}>
        <span className="text-h4 text-foreground font-bold">Fresh N Petals</span>
      </Link>

      {ADMIN_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'rounded-button text-body flex items-center gap-2 px-2 py-2 transition-colors',
              active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
