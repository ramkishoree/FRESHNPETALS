import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfidenceBadge } from './confidence-badge';

describe('ConfidenceBadge', () => {
  it('renders the clamped, rounded percentage', () => {
    render(<ConfidenceBadge score={87.6} />);
    expect(screen.getByText('88% confidence')).toBeInTheDocument();
  });

  it('clamps a score above 100', () => {
    render(<ConfidenceBadge score={140} />);
    expect(screen.getByText('100% confidence')).toBeInTheDocument();
  });

  it('clamps a negative score to 0', () => {
    render(<ConfidenceBadge score={-20} />);
    expect(screen.getByText('0% confidence')).toBeInTheDocument();
  });
});
