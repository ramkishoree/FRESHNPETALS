import {
  type AppError,
  BusinessRuleError,
  err,
  InfrastructureError,
  ok,
  type Result,
} from '@prana/core';
import {
  type AdminInventoryAdjustment,
  type InventoryRecord,
  type InventoryRepository,
  validateAdminInventoryAdjustment,
} from '../../domain/inventory';

/** Ch.16 §95 + Ch.8 §45: every stock movement is a validated, audited transaction. */
export class AdjustInventoryService {
  constructor(private readonly inventory: InventoryRepository) {}

  async execute(
    inventoryId: string,
    adjustment: AdminInventoryAdjustment,
    actorId: string,
  ): Promise<Result<InventoryRecord, AppError>> {
    const violations = validateAdminInventoryAdjustment(adjustment);
    if (violations.length > 0) {
      return err(new BusinessRuleError(violations.join(' ')));
    }

    const current = await this.inventory.findById(inventoryId);
    if (!current) {
      return err(new BusinessRuleError('Inventory record not found.', { httpStatus: 404 }));
    }
    if (current.physicalQuantity + adjustment.quantityDelta < 0) {
      return err(
        new BusinessRuleError(
          `Adjustment would take physical quantity below zero (currently ${current.physicalQuantity}).`,
        ),
      );
    }

    try {
      const updated = await this.inventory.adjust(inventoryId, adjustment, actorId);
      return ok(updated);
    } catch (cause) {
      return err(
        new InfrastructureError('Failed to adjust inventory.', {
          cause: cause instanceof Error ? cause.message : String(cause),
        }),
      );
    }
  }
}
