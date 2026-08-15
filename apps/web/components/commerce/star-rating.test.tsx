import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StarRating } from './star-rating';

function filledCount(container: HTMLElement): number {
  return container.querySelectorAll('.fill-accent').length;
}

describe('StarRating', () => {
  it('rounds to the nearest whole star', () => {
    // The owner's call: no half stars. Six reviews cannot really tell
    // 4.4 from 4.6 apart, so a half-filled star would claim precision
    // the sample size has not earned.
    expect(filledCount(render(<StarRating rating={4.4} />).container)).toBe(4);
    expect(filledCount(render(<StarRating rating={4.6} />).container)).toBe(5);
    expect(filledCount(render(<StarRating rating={3.5} />).container)).toBe(4);
  });

  it('always draws five stars, filled or not', () => {
    const { container } = render(<StarRating rating={2} />);

    expect(container.querySelectorAll('svg')).toHaveLength(5);
    expect(filledCount(container)).toBe(2);
  });

  it('prints the exact average beside the rounded stars', () => {
    render(<StarRating rating={4.4} count={7} />);

    expect(screen.getByText('4.4 (7)')).toBeInTheDocument();
  });

  it('announces the average and the sample size together', () => {
    // A lone "4.4 out of 5" invites more trust than one review deserves.
    render(<StarRating rating={4.4} count={1} />);

    expect(screen.getByRole('img')).toHaveAttribute('aria-label', '4.4 out of 5 from 1 review');
  });
});
