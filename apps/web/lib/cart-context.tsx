'use client';

import * as React from 'react';

export interface CartLineItem {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  unitPrice: number;
  salePrice: number | null;
  quantity: number;
}

interface CartContextValue {
  items: CartLineItem[];
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartLineItem, 'quantity'>, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const CartContext = React.createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'fnp-cart';

/**
 * Ch.6/Ch.12 §24 Cart Experience — no `cart` table exists anywhere in
 * Ch.10's schema; the first server-persisted cart-like structure is
 * `checkout_sessions.cart_snapshot` (Ch.8 §91), created when checkout
 * actually starts (Phase 10). Until then the cart is guest-first,
 * client-side state — the same storage pattern Ch.12 §33 already
 * specifies for Recently Viewed ("Guest: Local Storage").
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartLineItem[]>([]);
  const [isHydrated, setIsHydrated] = React.useState(false);

  React.useEffect(() => {
    // Standard client-only hydration idiom: localStorage doesn't exist
    // during SSR, so it can only be read post-mount, in an effect. Runs
    // once (empty deps); doesn't cascade.
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw) as CartLineItem[]);
    } catch {
      // Corrupt/unavailable storage — start with an empty cart rather than crash.
    }
    setIsHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, isHydrated]);

  const addItem = React.useCallback((item: Omit<CartLineItem, 'quantity'>, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((line) => line.productId === item.productId);
      if (existing) {
        return prev.map((line) =>
          line.productId === item.productId
            ? { ...line, quantity: line.quantity + quantity }
            : line,
        );
      }
      return [...prev, { ...item, quantity }];
    });
  }, []);

  const setQuantity = React.useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((line) => line.productId !== productId)
        : prev.map((line) => (line.productId === productId ? { ...line, quantity } : line)),
    );
  }, []);

  const removeItem = React.useCallback((productId: string) => {
    setItems((prev) => prev.filter((line) => line.productId !== productId));
  }, []);

  const clear = React.useCallback(() => setItems([]), []);

  const itemCount = items.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = items.reduce(
    (sum, line) => sum + (line.salePrice ?? line.unitPrice) * line.quantity,
    0,
  );

  const value = React.useMemo(
    () => ({ items, itemCount, subtotal, addItem, setQuantity, removeItem, clear }),
    [items, itemCount, subtotal, addItem, setQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = React.useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider.');
  return context;
}
