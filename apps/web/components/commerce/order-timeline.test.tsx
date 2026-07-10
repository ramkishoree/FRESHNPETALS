import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OrderTimeline } from './order-timeline';

describe('OrderTimeline', () => {
  it('renders every non-terminal step for the happy path', () => {
    render(<OrderTimeline status="preparing" />);
    expect(screen.getByText('Preparing your order')).toBeInTheDocument();
    expect(screen.getByText('Out for delivery')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders a terminal failure as its own stop, not a step toward "done"', () => {
    render(<OrderTimeline status="cancelled" />);
    expect(screen.getByText('Order cancelled')).toBeInTheDocument();
    // The happy-path steps after cancellation never happened.
    expect(screen.queryByText('Out for delivery')).not.toBeInTheDocument();
  });

  it('renders a refunded order after delivery as a failure stop', () => {
    render(<OrderTimeline status="refunded" timestamps={{ delivered: '2026-01-01T00:00:00Z' }} />);
    expect(screen.getByText('Order refunded')).toBeInTheDocument();
  });
});
