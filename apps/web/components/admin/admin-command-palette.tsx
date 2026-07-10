'use client';

import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ADMIN_NAV } from './admin-nav-config';

export interface AdminCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Ch.12 §60 Command Palette — navigates the admin nav tree. Ctrl/Cmd+K wiring and open state live in AdminShell, the one place that also needs to know "is the palette open" (to route the topbar's Search button to the same instance). */
export function AdminCommandPalette({ open, onOpenChange }: AdminCommandPaletteProps) {
  const router = useRouter();

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Jump to any admin page"
    >
      <CommandInput placeholder="Search pages and commands..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Pages">
          {ADMIN_NAV.flatMap((item) => [item, ...(item.children ?? [])]).map((item) => (
            <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
