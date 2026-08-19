'use client';

import { Menu, Search, ShoppingBag, User } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useCart } from '@/lib/cart-context';

const PRIMARY_NAV = [
  { href: '/', label: 'Products' },
  { href: '/account/orders', label: 'Orders' },
  { href: '/account', label: 'My Account' },
];

/**
 * Owner's explicit call: exactly three destinations — Products, Orders,
 * My Account — and nothing else. Editorial header treatment per the
 * owner's reference design: bare, sticky, blurred paper backdrop, small
 * serif wordmark, thin-tracked nav links.
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
        {/* Three columns, and the outer two share the leftover width
            equally. The nav used to be the `flex-1` element and centred
            itself inside whatever space the flanks left over — which is
            the page's centre only while the brand and the icon cluster
            happen to be the same width. They never were, and widening
            the brand with the emblem made the drift obvious. */}
        <div className="flex min-w-0 flex-1 items-center gap-1">
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
              </nav>
            </SheetContent>
          </Sheet>

          {/* The emblem, plus the name as real text.
            Deliberately not the whole circular logo: it carries the
            wordmark and the "flowers that speak from the heart" line
            inside it, and at the ~40px a header allows those render at
            two or three pixels — mush, and a brand name a crawler and a
            screen reader cannot read. The emblem stays crisp at any
            size, and the name beside it stays selectable text. */}
          <Link href="/" className="brand brand-lockup" aria-label="Fresh N Petals — home">
            <Image
              src="/logo-emblem.webp"
              alt=""
              width={256}
              height={256}
              priority
              sizes="44px"
              className="brand-emblem"
            />
            <span>
              Fresh <em>N</em> Petals
            </span>
          </Link>
        </div>

        <nav className="top-nav hidden justify-center lg:flex" aria-label="Primary navigation">
          {PRIMARY_NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
          {searchOpen ? (
            <form onSubmit={submitSearch} className="flex max-w-[220px] items-center sm:max-w-xs">
              <Input
                id="site-search"
                name="q"
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
