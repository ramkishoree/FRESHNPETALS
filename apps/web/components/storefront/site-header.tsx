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
 * Account, nothing else in the primary nav. Editorial header treatment
 * per the owner's reference design: bare, sticky, blurred paper
 * backdrop, small serif wordmark, thin-tracked nav links.
 */
export function SiteHeader() {
  const { itemCount } = useCart();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const [searchOpen, setSearchOpen] = React.useState(false);
  const router = useRouter();

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!searchValue.trim()) return;
    router.push(`/search?q=${encodeURIComponent(searchValue.trim())}`);
  }

  return (
    <header className="top">
      <div className="wrap top-in">
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
                  className="serif px-2 py-2 text-base"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/account"
                onClick={() => setMobileOpen(false)}
                className="serif px-2 py-2 text-base"
              >
                Account
              </Link>
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" className="brand">
          Fresh <em>&amp;</em> Petals
        </Link>

        <nav className="top-nav hidden lg:flex" aria-label="Primary navigation">
          {PRIMARY_NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {searchOpen ? (
            <form onSubmit={submitSearch} className="flex max-w-[220px] items-center sm:max-w-xs">
              <Input
                autoFocus
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                onBlur={() => {
                  if (!searchValue.trim()) setSearchOpen(false);
                }}
                placeholder="Search flowers, gifts, occasions…"
                aria-label="Search"
                className="serif border-0 border-b border-[var(--line)] bg-transparent focus-visible:ring-0"
              />
            </form>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-4" />
            </Button>
          )}
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
              <ShoppingBag
                className="size-4"
                style={{ color: itemCount > 0 ? 'var(--petal)' : undefined }}
              />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[var(--petal)] text-[10px] font-semibold text-white">
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
