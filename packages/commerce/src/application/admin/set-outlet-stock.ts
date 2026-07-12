import {
  type AppError,
  BusinessRuleError,
  err,
  InfrastructureError,
  ok,
  type Result,
} from '@prana/core';
import {
  type InventoryRecord,
  type InventoryRepository,
  validateSetOutletStock,
} from '../../domain/inventory';

/** Owner's explicit call: price/sale price/photo stay uniform across every
 *  outlet — stock is the one thing that varies. Sets (not deltas) the
 *  outlet's stock; the repository creates the inventory row on first use
 *  rather than requiring one to already exist. */
export class SetOutletStockService {
  constructor(private readonly inventory: InventoryRepository) {}

  async execute(
    productId: string,
    outletId: string,
    quantity: number,
    actorId: string,
    reason?: string,
  ): Promise<Result<InventoryRecord, AppError>> {
    const violations = validateSetOutletStock(quantity);
    if (violations.length > 0) {
      return err(new BusinessRuleError(violations.join(' ')));
    }

    try {
      const updated = await this.inventory.setStock(productId, outletId, quantity, actorId, reason);
      return ok(updated);
    } catch (cause) {
      return err(
        new InfrastructureError('Failed to set outlet stock.', {
          cause: cause instanceof Error ? cause.message : String(cause),
        }),
      );
    }
  }
}
