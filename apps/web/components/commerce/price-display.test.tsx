import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriceDisplay } from './price-display';

describe('PriceDisplay', () => {
  it('shows only the base price when there is no discount', () => {
    render(<PriceDisplay basePrice={1499} />);
    expect(screen.getByText('₹1,499')).toBeInTheDocument();
  });

  it('shows the sale price and a struck-through base price when discounted', () => {
    render(<PriceDisplay basePrice={1499} salePrice={1299} />);
    expect(screen.getByText('₹1,299')).toBeInTheDocument();
    expect(screen.getByText('₹1,499')).toBeInTheDocument();
  });

  it('does not treat a sale price equal to base price as a discount', () => {
    render(<PriceDisplay basePrice={1000} salePrice={1000} />);
    expect(screen.getAllByText('₹1,000')).toHaveLength(1);
  });

  it('announces the discount to screen readers', () => {
    render(<PriceDisplay basePrice={1499} salePrice={1299} />);
    expect(screen.getByText(/reduced from/i)).toBeInTheDocument();
  });
});
