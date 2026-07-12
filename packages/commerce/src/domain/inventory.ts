import type { ReadRepository } from '@prana/core';

/** Mirrors infrastructure/database/migrations/0005 `inventory`. */
export interface InventoryRecord {
  id: string;
  productId: string;
  outletId: string;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  criticalThreshold: number;
  reorderQuantity: number;
}

/**
 * Ch.8 §45: the manual/admin-facing subset of `inventory_transaction_type`
 * — `reservation`/`reservation_release`/`sale`/`refund` are order-
 * lifecycle-driven (Phase 10), never something an administrator picks
 * from a dropdown.
 */
export type AdminInventoryTransactionType = 'stock_added' | 'damage' | 'correction';

export interface AdminInventoryAdjustment {
  transactionType: AdminInventoryTransactionType;
  /** Signed — positive restocks, negative removes (damage is always negative). */
  quantityDelta: number;
  reason?: string;
}

export interface InventoryRepository extends ReadRepository<InventoryRecord> {
  findByProductAndOutlet(productId: string, outletId: string): Promise<InventoryRecord | null>;
  adjust(
    inventoryId: string,
    adjustment: AdminInventoryAdjustment,
    actorId: string,
  ): Promise<InventoryRecord>;
  /** Sets (not deltas) an outlet's stock, creating the row on first use —
   *  every product/outlet pair has no row until an admin touches it once. */
  setStock(
    productId: string,
    outletId: string,
    quantity: number,
    actorId: string,
    reason?: string,
  ): Promise<InventoryRecord>;
}

/**
 * Ch.8 §45's own type list already implies the sign: "damage" can only
 * ever remove stock, "stock added" can only ever add it — a positive
 * "damage" delta or negative "stock added" delta is a data-entry mistake
 * the UI should never be able to submit, so it's rejected here rather
 * than silently accepted.
 */
export function validateAdminInventoryAdjustment(adjustment: AdminInventoryAdjustment): string[] {
  const violations: string[] = [];

  if (adjustment.quantityDelta === 0) {
    violations.push('Quantity delta cannot be zero.');
  }
  if (adjustment.transactionType === 'stock_added' && adjustment.quantityDelta < 0) {
    violations.push('Stock added must increase quantity.');
  }
  if (adjustment.transactionType === 'damage' && adjustment.quantityDelta > 0) {
    violations.push('Damage can only decrease quantity.');
  }
  if (adjustment.transactionType === 'damage' && !adjustment.reason?.trim()) {
    violations.push('A reason is required when recording damage.');
  }

  return violations;
}

/** Per-outlet stock is the one thing that's allowed to vary by outlet
 *  (owner's explicit call — price/sale price/photo stay uniform). */
export function validateSetOutletStock(quantity: number): string[] {
  const violations: string[] = [];

  if (!Number.isInteger(quantity)) {
    violations.push('Quantity must be a whole number.');
  }
  if (quantity < 0) {
    violations.push('Quantity cannot be negative.');
  }

  return violations;
}
