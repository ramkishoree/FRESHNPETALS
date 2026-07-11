// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sweepReviewRequestNudges } from './review-nudge-sweep';

const { isEmailConfiguredMock, sendEmailMock } = vi.hoisted(() => ({
  isEmailConfiguredMock: vi.fn(),
  sendEmailMock: vi.fn(),
}));

vi.mock('@/server/email/resend-client', () => ({
  isEmailConfigured: isEmailConfiguredMock,
  sendEmail: sendEmailMock,
}));

function makeDelivery(overrides: Record<string, unknown> = {}) {
  return {
    order_id: 'order-1',
    orders: {
      id: 'order-1',
      order_number: 'FNP-2026-000001',
      customer_id: 'cust-1',
      order_items: [{ product_name: 'Rose Bouquet' }],
      customers: { email: 'customer@example.com', first_name: 'Priya' },
    },
    ...overrides,
  };
}

function makeAdmin(deliveries: unknown[], alreadyNudgedOrderIds: string[] = []) {
  const insertedEvents: Record<string, unknown>[] = [];

  const from = vi.fn((table: string) => {
    if (table === 'deliveries') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: deliveries, error: null }),
      };
    }
    if (table === 'order_events') {
      let queriedOrderId: string | undefined;
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((column: string, value: string) => {
          if (column === 'order_id') queriedOrderId = value;
          return {
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn((): Promise<{ data: unknown }> =>
              Promise.resolve({
                data:
                  queriedOrderId && alreadyNudgedOrderIds.includes(queriedOrderId)
                    ? { id: 'existing-event' }
                    : null,
              }),
            ),
          };
        }),
        insert: vi.fn((row: Record<string, unknown>) => {
          insertedEvents.push(row);
          return Promise.resolve({ error: null });
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from, insertedEvents } as any;
}

describe('sweepReviewRequestNudges', () => {
  beforeEach(() => {
    isEmailConfiguredMock.mockReset();
    sendEmailMock.mockReset();
    process.env['NEXT_PUBLIC_APP_URL'] = 'http://localhost:3100';
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'http://localhost:54321';
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = 'anon';
  });

  it('does nothing when email is not configured', async () => {
    isEmailConfiguredMock.mockReturnValue(false);
    const admin = makeAdmin([makeDelivery()]);

    await sweepReviewRequestNudges(admin);

    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('sends a review-request email and records the dedupe event for an eligible delivery', async () => {
    isEmailConfiguredMock.mockReturnValue(true);
    sendEmailMock.mockResolvedValue(undefined);
    const admin = makeAdmin([makeDelivery()]);

    await sweepReviewRequestNudges(admin);

    expect(sendEmailMock).toHaveBeenCalledOnce();
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'customer@example.com' }),
    );
    expect(admin.insertedEvents).toEqual([
      expect.objectContaining({ order_id: 'order-1', event_type: 'review.nudge_sent' }),
    ]);
  });

  it('skips a delivery whose order has no customer email on file', async () => {
    isEmailConfiguredMock.mockReturnValue(true);
    const admin = makeAdmin([
      makeDelivery({
        orders: {
          id: 'order-2',
          order_number: 'FNP-2026-000002',
          customer_id: 'cust-2',
          order_items: [],
          customers: { email: null, first_name: null },
        },
      }),
    ]);

    await sweepReviewRequestNudges(admin);

    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('does not re-nudge an order that already has a review.nudge_sent event', async () => {
    isEmailConfiguredMock.mockReturnValue(true);
    const admin = makeAdmin([makeDelivery()], ['order-1']);

    await sweepReviewRequestNudges(admin);

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(admin.insertedEvents).toHaveLength(0);
  });
});
