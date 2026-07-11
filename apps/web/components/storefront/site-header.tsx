'use client';

import { Menu, Search, ShoppingBag, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useCart } from '@/lib/cart-context';

export interface StorefrontCategory {
  id: string;
  name: string;
  slug: string;
}

/** Ch.12 §17 Navigation — sticky, desktop: logo/search/categories/offers/blog/contact/account/cart; mobile: hamburger -> drawer. */
export function SiteHeader({ categories }: { categories: StorefrontCategory[] }) {
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
