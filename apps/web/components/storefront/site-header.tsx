'use client';

import { Menu, Search, ShoppingBag, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useCart } from '@/lib/cart-context';

const PRIMARY_NAV = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Products' },
  { href: '/blog', label: 'Blog' },
  { href: '/delivery-policy', label: 'Delivery policy' },
  { href: '/account/orders', label: 'Orders' },
];

/**
 * Owner's explicit call: "dead simple" — Home/Products/Blog/Orders/
 * Account, nothing else in the primary nav. Category links (Bouquets/
 * Anniversary/etc.) used to live here too; they're dropped since the
 * homepage's own category grid and the shop's floating category bar
 * already cover that browsing path — the header's job is now just the
 * five fixed destinations. About/FAQ/Terms/Privacy stay footer-only.
 */
export function SiteHeader() {
  const { itemCount } = useCart();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const router = useRouter();

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!searchValue.trim()) return;
    router.push(`/search?q=${encodeURIComponent(searchValue.trim())}`);
  }

  return (
    <header className="border-border bg-background sticky top-0 z-40 border-b">
      <div className="container-brand flex h-16 items-center gap-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <nav className="flex flex-col gap-1 pt-8" aria-label="Mobile navigation">
              {PRIMARY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-button text-body px-2 py-2 font-medium"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/account"
                onClick={() => setMobileOpen(false)}
                className="rounded-button text-body px-2 py-2 font-medium"
              >
                Account
              </Link>
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" className="text-h4 text-foreground shrink-0 font-bold">
          Fresh &amp; Petals
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-body text-foreground hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <form
          onSubmit={submitSearch}
          className="ml-auto hidden max-w-sm flex-1 items-center gap-2 md:flex"
        >
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search flowers, gifts, occasions..."
            aria-label="Search"
          />
          <Button type="submit" variant="ghost" size="icon" aria-label="Submit search">
            <Search className="size-4" />
          </Button>
        </form>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Button asChild variant="ghost" size="icon" aria-label="Account">
            <Link href="/account">
              <User className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={`Cart, ${itemCount} items`}
          >
            <Link href="/cart">
              <ShoppingBag className="size-4" />
              {itemCount > 0 && (
                <span className="bg-accent text-accent-foreground absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
