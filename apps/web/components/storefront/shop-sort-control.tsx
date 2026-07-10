'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
    <Select value={currentSort ?? 'newest'} onValueChange={setSort}>
      <SelectTrigger className="w-40" aria-label="Sort products">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="newest">Newest</SelectItem>
        <SelectItem value="name_asc">Name (A-Z)</SelectItem>
      </SelectContent>
    </Select>
  );
}
