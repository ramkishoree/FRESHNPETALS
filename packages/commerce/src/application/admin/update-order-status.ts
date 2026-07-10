import {
  type AppError,
  BusinessRuleError,
  err,
  InfrastructureError,
  ok,
  type Result,
} from '@prana/core';
import {
  canTransitionOrderStatus,
  type Order,
  type OrderRepository,
  type OrderStatus,
} from '../../domain/order';

/** Ch.8 §105 Order State Machine — the only transitions this rejects are ones the diagram never draws. */
export class UpdateOrderStatusService {
  constructor(private readonly orders: OrderRepository) {}

  async execute(
    id: string,
    status: OrderStatus,
    actorId: string,
    notes?: string,
  ): Promise<Result<Order, AppError>> {
    const current = await this.orders.findById(id);
    if (!current) {
      return err(new BusinessRuleError('Order not found.', { httpStatus: 404 }));
    }

    if (!canTransitionOrderStatus(current.status, status)) {
      return err(
        new BusinessRuleError(`Cannot move an order from "${current.status}" to "${status}".`),
      );
    }

    try {
      const updated = await this.orders.updateStatus(id, status, actorId, notes);
      return ok(updated);
    } catch (cause) {
      return err(
        new InfrastructureError('Failed to update order status.', {
          cause: cause instanceof Error ? cause.message : String(cause),
        }),
      );
    }
  }
}
