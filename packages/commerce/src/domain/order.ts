import type { ReadRepository } from '@prana/core';

/** Mirrors infrastructure/database/migrations/0006 `orders`. */
export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'refunded';

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  outletId: string;
  status: OrderStatus;
  grandTotal: number;
  notes: string | null;
}

/** Ch.8 §105 Order State Machine — exactly the edges the diagram draws. */
export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_payment: ['paid', 'failed'],
  paid: ['confirmed', 'refunded'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready'],
  ready: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
  failed: [],
  refunded: [],
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return from === to || ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export interface OrderRepository extends ReadRepository<Order> {
  updateStatus(id: string, status: OrderStatus, actorId: string, notes?: string): Promise<Order>;
  updateNotes(id: string, notes: string): Promise<Order>;
}
