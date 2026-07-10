'use client';

import { LogOut, Menu, Search } from 'lucide-react';
import * as React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AdminSidebar } from './admin-sidebar';

export interface AdminTopbarProps {
  userEmail: string;
  onOpenCommandPalette: () => void;
  onSignOut: () => void;
}

/** Ch.12 §43 Top Navigation: Search, Notifications, AI Status, Quick Actions, User Profile. Notification Center/AI Status are Phase 11's job to populate; the shell lives here. */
export function AdminTopbar({ userEmail, onOpenCommandPalette, onSignOut }: AdminTopbarProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="border-border flex h-14 items-center justify-between gap-3 border-b px-4">
      <div className="flex items-center gap-2">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Admin navigation</SheetTitle>
            <AdminSidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground gap-2"
          onClick={onOpenCommandPalette}
        >
          <Search className="size-4" aria-hidden="true" />
          Search
          <kbd className="border-border text-caption ml-2 hidden rounded border px-1.5 sm:inline">
            ⌘K
          </kbd>
        </Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Account menu">
            <Avatar className="size-8">
              <AvatarFallback>{userEmail.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled className="text-muted-foreground">
            {userEmail}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSignOut} variant="destructive">
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
