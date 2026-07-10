/**
 * Ch.11 §9: domain services emit events; publication happens after the
 * transaction commits, via the Outbox Pattern (event_store + outbox_events,
 * infrastructure/database/migrations/0008). Mirrors that table's shape.
 */
export interface DomainEvent<TPayload = Record<string, unknown>> {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  causationId?: string;
}

export function createDomainEvent<TPayload = Record<string, unknown>>(
  event: DomainEvent<TPayload>,
): DomainEvent<TPayload> {
  return event;
}
