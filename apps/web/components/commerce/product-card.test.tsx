import type { Product } from '@prana/commerce';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductCard } from './product-card';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    sku: 'SKU-1',
    slug: 'red-roses',
    name: 'Dozen Red Roses',
    shortDescription: null,
    color: 'Red',
    type: null,
    featuredImage: null,
    images: [],
    status: 'published',
    basePrice: 999,
    salePrice: null,
    availableQuantity: 5,
    ...overrides,
  };
}

describe('ProductCard', () => {
  it('prints the type above the name', () => {
    const { container } = render(<ProductCard product={makeProduct({ type: 'Bouquet' })} />);

    expect(screen.getByText('Bouquet')).toBeInTheDocument();
    // Order matters: the label introduces the name, so it has to come
    // first in the document, not merely be present somewhere.
    const text = container.querySelector('.plate-text')?.textContent ?? '';
    expect(text.indexOf('Bouquet')).toBeLessThan(text.indexOf('Dozen Red Roses'));
  });

  it('renders no type element at all when there is none', () => {
    // Not an empty <p>: a blank line here would push an untyped
    // product's name a line lower than its neighbours across the grid.
    const { container } = render(<ProductCard product={makeProduct()} />);

    expect(container.querySelector('.plate-type')).toBeNull();
  });

  it('keeps colour off the card', () => {
    // The owner's call: colour belongs on the product page beside the
    // other attributes a buyer weighs. A grid is scanned, not read.
    // A name that does not itself contain the colour word, so this
    // asserts the colour is gone rather than that the name is.
    const { container } = render(
      <ProductCard product={makeProduct({ name: 'Anniversary Bouquet', color: 'Blush' })} />,
    );

    expect(screen.queryByText(/Blush/)).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('Blush');
  });
});
