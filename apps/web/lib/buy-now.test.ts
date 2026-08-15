import { beforeEach, describe, expect, it } from 'vitest';
import { clearBuyNowItem, readBuyNowItem, setBuyNowItem } from './buy-now';

const ITEM = {
  productId: '00000000-0000-0000-0000-000000000301',
  slug: 'dozen-red-roses',
  name: 'Dozen Red Roses',
  image: null,
  unitPrice: 999,
  salePrice: null,
  quantity: 2,
};

describe('buy now', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('round-trips the item it was handed', () => {
    setBuyNowItem(ITEM);

    expect(readBuyNowItem()).toEqual(ITEM);
  });

  it('never touches the basket', () => {
    // The whole reason this exists: buying one thing outright must not
    // empty a basket the customer is still assembling.
    window.localStorage.setItem('fnp-cart', JSON.stringify([ITEM]));
    setBuyNowItem({ ...ITEM, productId: 'other' });
    clearBuyNowItem();

    expect(window.localStorage.getItem('fnp-cart')).toBe(JSON.stringify([ITEM]));
  });

  it('reports nothing once cleared', () => {
    setBuyNowItem(ITEM);
    clearBuyNowItem();

    expect(readBuyNowItem()).toBeNull();
  });

  it('reports nothing rather than a broken line when storage is corrupt', () => {
    // Checkout falls back to the basket on null. A half-parsed item
    // would instead have replaced the basket with a line that has no
    // product to sell.
    window.sessionStorage.setItem('fnp-buy-now', '{not json');
    expect(readBuyNowItem()).toBeNull();

    window.sessionStorage.setItem('fnp-buy-now', JSON.stringify({ ...ITEM, quantity: 0 }));
    expect(readBuyNowItem()).toBeNull();

    window.sessionStorage.setItem('fnp-buy-now', JSON.stringify({ quantity: 1 }));
    expect(readBuyNowItem()).toBeNull();
  });
});
