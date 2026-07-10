import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DiscountBadge } from './discount-badge';

describe('DiscountBadge', () => {
  it('renders nothing when there is no sale price', () => {
    const { container } = render(<DiscountBadge basePrice={1000} salePrice={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when sale price is not actually lower', () => {
    const { container } = render(<DiscountBadge basePrice={1000} salePrice={1000} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the rounded percentage off', () => {
    render(<DiscountBadge basePrice={1000} salePrice={750} />);
    expect(screen.getByText('25% OFF')).toBeInTheDocument();
  });

  it('rounds to the nearest percent', () => {
    render(<DiscountBadge basePrice={300} salePrice={199} />);
    // (300-199)/300 = 33.67% -> rounds to 34%
    expect(screen.getByText('34% OFF')).toBeInTheDocument();
  });
});
