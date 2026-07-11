import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CartProvider, useCart } from './cart-context';

function makeItem(overrides: Partial<Parameters<ReturnType<typeof useCart>['addItem']>[0]> = {}) {
  return {
    productId: '11111111-1111-4111-8111-111111111111',
    slug: 'rose-bouquet',
    name: 'Rose Bouquet',
    image: null,
    unitPrice: 999,
    salePrice: null,
    ...overrides,
  };
}

describe('CartProvider / useCart', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('adds a new item with the given quantity', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    act(() => result.current.addItem(makeItem(), 2));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.quantity).toBe(2);
    expect(result.current.itemCount).toBe(2);
  });

  it('merges quantity when the same product is added again', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    act(() => result.current.addItem(makeItem(), 1));
    act(() => result.current.addItem(makeItem(), 3));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.quantity).toBe(4);
  });

  it('removes the line when setQuantity is called with 0', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    act(() => result.current.addItem(makeItem(), 1));
    act(() => result.current.setQuantity('11111111-1111-4111-8111-111111111111', 0));

    expect(result.current.items).toHaveLength(0);
  });

  it('computes subtotal using sale price when present', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    act(() => result.current.addItem(makeItem({ unitPrice: 999, salePrice: 799 }), 2));

    expect(result.current.subtotal).toBe(1598);
  });

  it('clear empties the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    act(() => result.current.addItem(makeItem(), 1));
    act(() => result.current.clear());

    expect(result.current.items).toHaveLength(0);
  });

  it('throws when used outside a CartProvider', () => {
    expect(() => renderHook(() => useCart())).toThrow(/CartProvider/);
  });

  it('ignores addItem calls with a non-UUID productId (checkout would 422 on it)', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    act(() => result.current.addItem(makeItem({ productId: 'not-a-uuid' }), 1));

    expect(result.current.items).toHaveLength(0);
  });

  it('drops a corrupted line from persisted localStorage on hydration', async () => {
    window.localStorage.setItem(
      'fnp-cart',
      JSON.stringify([
        { ...makeItem({ productId: 'not-a-uuid' }), quantity: 1 },
        { ...makeItem(), quantity: 2 },
      ]),
    );

    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.productId).toBe('11111111-1111-4111-8111-111111111111');
  });
});
