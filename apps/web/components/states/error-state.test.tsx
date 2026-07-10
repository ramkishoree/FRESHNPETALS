import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it("defaults to the handbook's own human-language copy (Ch.5.25), never a raw error", () => {
    render(<ErrorState />);
    expect(
      screen.getByText("We couldn't complete your request. Please try again in a moment."),
    ).toBeInTheDocument();
  });

  it('calls onRetry when the retry button is clicked', async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('has an alert role for assistive tech', () => {
    render(<ErrorState />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
