import { isErr, isOk } from '@prana/core';
import { describe, expect, it } from 'vitest';
import type { Order, OrderRepository, OrderStatus } from '../../domain/order';
import { UpdateOrderStatusService } from './update-order-status';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    orderNumber: 'ORD-1001',
    customerId: 'cust-1',
    outletId: 'outlet-1',
    status: 'pending_payment',
    grandTotal: 999,
    notes: null,
    ...overrides,
  };
}

class FakeOrderRepository implements OrderRepository {
  constructor(private order: Order | null) {}

  findById(id: string): Promise<Order | null> {
    return Promise.resolve(this.order && this.order.id === id ? this.order : null);
  }

  findMany(): Promise<{ items: Order[]; nextCursor: string | null }> {
    return Promise.resolve({ items: this.order ? [this.order] : [], nextCursor: null });
  }

  updateStatus(id: string, status: OrderStatus): Promise<Order> {
    if (!this.order) throw new Error('not found');
    this.order = { ...this.order, status };
    return Promise.resolve(this.order);
  }

  updateNotes(id: string, notes: string): Promise<Order> {
    if (!this.order) throw new Error('not found');
    this.order = { ...this.order, notes };
    return Promise.resolve(this.order);
  }
}

describe('UpdateOrderStatusService', () => {
  it('allows a valid transition (pending_payment -> paid)', async () => {
    const service = new UpdateOrderStatusService(new FakeOrderRepository(makeOrder()));

    const result = await service.execute('order-1', 'paid', 'actor-1');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value.status).toBe('paid');
  });

  it('rejects a transition the state machine does not draw (pending_payment -> delivered)', async () => {
    const service = new UpdateOrderStatusService(new FakeOrderRepository(makeOrder()));

    const result = await service.execute('order-1', 'delivered', 'actor-1');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe('BUSINESS_RULE_ERROR');
  });

  it('rejects any transition out of a terminal state', async () => {
    const service = new UpdateOrderStatusService(
      new FakeOrderRepository(makeOrder({ status: 'completed' })),
    );

    const result = await service.execute('order-1', 'refunded', 'actor-1');

    expect(isErr(result)).toBe(true);
  });

  it('returns a 404-shaped error for a missing order', async () => {
    const service = new UpdateOrderStatusService(new FakeOrderRepository(null));

    const result = await service.execute('missing', 'paid', 'actor-1');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.httpStatus).toBe(404);
  });
});
