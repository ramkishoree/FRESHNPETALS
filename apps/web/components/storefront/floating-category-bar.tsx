'use client';

import Link from 'next/link';

export interface CategoryPill {
  name: string;
  slug: string;
}

/**
 * Owner's explicit call: a sticky pill bar so switching categories while
 * browsing the full catalogue doesn't mean scrolling back to the header
 * nav — plain links to the existing `/shop/[category]` pages rather than
 * client-side filtering, so it works without JS and doesn't duplicate the
 * pagination/sorting `/shop` already has.
 */
export function FloatingCategoryBar({ categories }: { categories: CategoryPill[] }) {
  if (categories.length === 0) return null;

  return (
    <div className="bg-[var(--sf-surface)]/95 sticky top-16 z-30 -mx-4 border-b border-[var(--sf-border)] px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-full sm:border sm:px-2">
      <div className="flex gap-2 overflow-x-auto sm:justify-center">
        <Link
          href="/shop"
          className="shrink-0 rounded-full border border-[var(--sf-border)] px-4 py-1.5 text-sm font-medium hover:border-[var(--gold)] hover:text-[var(--gold-deep)]"
        >
          All
        </Link>
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/shop/${category.slug}`}
            className="shrink-0 rounded-full border border-[var(--sf-border)] px-4 py-1.5 text-sm font-medium hover:border-[var(--gold)] hover:text-[var(--gold-deep)]"
          >
            {category.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
