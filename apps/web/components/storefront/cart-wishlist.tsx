'use client';

import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { useCart } from '@/lib/cart-context';

interface WishlistProduct {
  id: string;
  slug: string;
  name: string;
  featured_image: string | null;
  status: string;
  product_prices: { base_price: number; sale_price: number | null } | null;
}

interface WishlistRow {
  id: string;
  products: WishlistProduct | WishlistProduct[] | null;
}

/**
 * Saved items, under the basket.
 *
 * The cart is where someone decides what they are actually buying today,
 * so it is the one place a saved-for-later list is worth showing: the
 * decision to promote something from "maybe" to "yes" happens here or
 * not at all.
 *
 * Renders nothing at all when signed out or empty. The wishlist endpoint
 * needs a session and answers 401 to a guest, which is not an error
 * worth showing — a guest simply has no saved items.
 */
export function CartWishlist() {
  const { addItem, items } = useCart();
  const [rows, setRows] = React.useState<WishlistRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    try {
      const response = await fetch('/api/v1/account/wishlist');
      if (!response.ok) return;
      const body = await response.json();
      if (body?.success) setRows((body.data?.items ?? body.data ?? []) as WishlistRow[]);
    } catch {
      // Saved items are a convenience; failing to load them must never
      // interfere with checking out.
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function moveToCart(product: WishlistProduct) {
    const price = Array.isArray(product.product_prices)
      ? product.product_prices[0]
      : product.product_prices;
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.featured_image,
      unitPrice: Number(price?.base_price ?? 0),
      salePrice: price?.sale_price != null ? Number(price.sale_price) : null,
    });
    toast.success(`${product.name} added to your basket.`);

    // Moved, not copied — leaving it in both lists means deciding twice.
    await fetch(`/api/v1/account/wishlist/${product.id}`, { method: 'DELETE' }).catch(() => {});
    await load();
  }

  const saved = rows
    .map((row) => (Array.isArray(row.products) ? row.products[0] : row.products))
    .filter((product): product is WishlistProduct => Boolean(product))
    .filter((product) => product.status === 'published')
    .filter((product) => !items.some((item) => item.productId === product.id));

  if (isLoading || saved.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-h3 mb-1">Saved for later</h2>
      <p className="text-caption text-[var(--sf-ink-muted)]">
        Still thinking about these? Move one across when you&rsquo;re ready.
      </p>

      <div className="mt-5 divide-y divide-[var(--sf-border)] rounded-[var(--r-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] px-5">
        {saved.map((product) => {
          const price = Array.isArray(product.product_prices)
            ? product.product_prices[0]
            : product.product_prices;
          const display = price?.sale_price ?? price?.base_price ?? 0;
          return (
            <div key={product.id} className="flex items-center gap-4 py-4">
              {product.featured_image ? (
                <Image
                  src={product.featured_image}
                  alt={product.name}
                  width={64}
                  height={64}
                  className="size-16 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="bg-muted size-16 shrink-0 rounded-md" />
              )}

              <div className="min-w-0 flex-1">
                <Link href={`/product/${product.slug}`} className="text-body font-medium">
                  {product.name}
                </Link>
                <p className="text-caption text-[var(--sf-ink-muted)]">₹{display}</p>
              </div>

              <button
                type="button"
                onClick={() => void moveToCart(product)}
                className="btn btn-primary shrink-0 px-4 py-2 text-sm"
              >
                Add to basket
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
