'use client';

import * as React from 'react';
import { AdminCommandPalette } from './admin-command-palette';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';

export function AdminShell({
  userEmail,
  onSignOut,
  children,
}: {
  userEmail: string;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex h-dvh">
      <aside className="border-border hidden w-64 shrink-0 border-r lg:block">
        <AdminSidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar
          userEmail={userEmail}
          onSignOut={onSignOut}
          onOpenCommandPalette={() => setPaletteOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <AdminCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
