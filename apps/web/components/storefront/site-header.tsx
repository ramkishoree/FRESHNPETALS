'use client';

import { MapPin, Menu, Search, ShoppingBag, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useCart } from '@/lib/cart-context';
import { useLocation, type LocationState } from '@/lib/use-location';

export interface StorefrontCategory {
  id: string;
  name: string;
  slug: string;
}

/** Human-readable label for the current location state, shown in the
 *  "Delivering to" badge so the user knows whether GPS is active. */
function locationLabel(state: LocationState): string {
  switch (state) {
    case 'idle':
      return 'Detect location';
    case 'loading':
      return 'Detecting…';
    case 'ok':
    case 'manual':
      return 'Location set ✓';
    case 'denied':
      return 'Enable GPS for accurate fee';
    case 'unavailable':
      return 'Location unavailable';
  }
}

/** Ch.12 §17 Navigation — sticky, desktop: logo/search/categories/offers/blog/contact/account/cart; mobile: hamburger -> drawer. */
export function SiteHeader({ categories }: { categories: StorefrontCategory[] }) {
  const { itemCount } = useCart();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const router = useRouter();
  const { coords, state, retry } = useLocation();

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
              <Link
                href="/shop"
                onClick={() => setMobileOpen(false)}
                className="rounded-button text-body px-2 py-2 font-medium"
              >
                Shop all
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/shop/${category.slug}`}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-button text-body text-muted-foreground px-2 py-2"
                >
                  {category.name}
                </Link>
              ))}
              <Link
                href="/blog"
                onClick={() => setMobileOpen(false)}
                className="rounded-button text-body text-muted-foreground px-2 py-2"
              >
                Blog
              </Link>
              <Link
                href="/contact"
                onClick={() => setMobileOpen(false)}
                className="rounded-button text-body text-muted-foreground px-2 py-2"
              >
                Contact
              </Link>
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" className="text-h4 text-foreground shrink-0 font-bold">
          Fresh &amp; Petals
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
          <Link href="/shop" className="text-body text-foreground hover:text-primary">
            Shop
          </Link>
          {categories.slice(0, 5).map((category) => (
            <Link
              key={category.id}
              href={`/shop/${category.slug}`}
              className="text-body text-muted-foreground hover:text-primary"
            >
              {category.name}
            </Link>
          ))}
          <Link href="/blog" className="text-body text-muted-foreground hover:text-primary">
            Blog
          </Link>
          <Link href="/contact" className="text-body text-muted-foreground hover:text-primary">
            Contact
          </Link>
        </nav>

        {/* Ch.12 §19 Location badge — prompted at the start of the session,
            not at checkout, so the delivery fee is transparent and cannot be
            bypassed by a last-minute denial. */}
        <div className="hidden md:block">
          <LocationBadge coords={coords} state={state} onRetry={retry} />
        </div>

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

      {/* Mobile location badge just below header */}
      <div className="border-t border-[var(--sf-border)] px-4 py-2 md:hidden">
        <LocationBadge coords={coords} state={state} onRetry={retry} compact />
      </div>
    </header>
  );
}

/** Small badge shown in the header: "📍 Delivering to ..." with a popover
 *  for manual fallback when GPS is denied. */
function LocationBadge({
  coords,
  state,
  onRetry,
  compact,
}: {
  coords: { lat: number; lng: number } | null;
  state: LocationState;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`gap-1.5 text-xs ${compact ? 'w-full justify-start px-0' : ''}`}
        >
          <MapPin className="size-3.5 shrink-0 text-[var(--green)]" />
          <span className="truncate">{locationLabel(state)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-72 p-4">
        <div className="space-y-3">
          <p className="text-sm font-medium">Delivery location</p>
          {coords ? (
            <p className="text-xs text-[var(--sf-ink-muted)]">
              Location set{state === 'manual' ? ' (manual)' : ' via GPS'}. Delivery fee is
              calculated from the distance to the nearest outlet.
            </p>
          ) : state === 'denied' || state === 'unavailable' ? (
            <p className="text-xs text-[var(--sf-ink-muted)]">
              Location access was denied. You can still place an order — the delivery fee will be
              based on the address you enter at checkout.
            </p>
          ) : state === 'loading' ? (
            <p className="text-xs text-[var(--sf-ink-muted)]">Detecting your location…</p>
          ) : (
            <p className="text-xs text-[var(--sf-ink-muted)]">
              Allow location access so we can show the nearest outlet and accurate delivery fee.
            </p>
          )}
          {state === 'denied' || state === 'unavailable' ? (
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
