import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InventoryBadge } from './inventory-badge';

describe('InventoryBadge', () => {
  it('shows "Out of stock" at zero', () => {
    render(<InventoryBadge availableQuantity={0} lowStockThreshold={5} />);
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
  });

  it('shows a critical-count message at or below the critical threshold', () => {
    render(<InventoryBadge availableQuantity={1} lowStockThreshold={5} criticalThreshold={1} />);
    expect(screen.getByText('Only 1 left')).toBeInTheDocument();
  });

  it('shows "Low stock" between critical and low thresholds', () => {
    render(<InventoryBadge availableQuantity={3} lowStockThreshold={5} criticalThreshold={1} />);
    expect(screen.getByText('Low stock')).toBeInTheDocument();
  });

  it('shows "In stock" above the low-stock threshold', () => {
    render(<InventoryBadge availableQuantity={50} lowStockThreshold={5} />);
    expect(screen.getByText('In stock')).toBeInTheDocument();
  });
});
