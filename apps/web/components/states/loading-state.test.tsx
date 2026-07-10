import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingState } from './loading-state';

describe('LoadingState', () => {
  it('renders the requested number of skeleton rows for the text variant', () => {
    const { container } = render(<LoadingState variant="text" count={4} />);
    expect(container.querySelectorAll('[class*="animate-pulse"]')).toHaveLength(4);
  });

  it('renders card skeletons with an image, title, and price placeholder each', () => {
    const { container } = render(<LoadingState variant="cards" count={2} />);
    // 3 skeleton pieces per card (image + 2 text lines) x 2 cards
    expect(container.querySelectorAll('[class*="animate-pulse"]')).toHaveLength(6);
  });

  it('defaults to the text variant', () => {
    const { container } = render(<LoadingState count={3} />);
    expect(container.querySelectorAll('[class*="animate-pulse"]')).toHaveLength(3);
  });
});
