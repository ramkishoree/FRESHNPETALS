'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DEFAULT_SORT, SORT_OPTIONS } from '@/server/storefront/shop-query';

/** Ch.12 §19/§20 — sorting updates the URL (`?sort=`), supporting sharing per §20's "Filters update URL parameters." */
export function ShopSortControl({ currentSort }: { currentSort?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-caption">Sort</span>
      <Select value={currentSort ?? DEFAULT_SORT} onValueChange={setSort}>
        <SelectTrigger
          aria-label="Sort products"
          className="min-w-[168px] rounded-[var(--r-pill)] border-[var(--sf-border-strong)] bg-[var(--sf-surface)] text-sm text-[var(--sf-ink)]"
        >
          <SelectValue />
        </SelectTrigger>
        {/* `sort-menu` rather than the usual `bg-[var(--sf-surface)]`:
            Radix portals this menu to <body>, outside the element that
            carries the storefront palette, so every `--sf-*` token
            resolved to nothing and the panel painted transparent — the
            product photographs underneath showed straight through the
            options. See `.sort-menu` for the opaque values. */}
        <SelectContent className="sort-menu">
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
