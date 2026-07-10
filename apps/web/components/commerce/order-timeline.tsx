import { Timeline } from './timeline';

/** Ch.10 §43 order_status state machine — the non-terminal happy path. */
const ORDER_STEPS = [
  { key: 'pending_payment', label: 'Payment pending' },
  { key: 'paid', label: 'Payment confirmed' },
  { key: 'confirmed', label: 'Order confirmed' },
  { key: 'preparing', label: 'Preparing your order' },
  { key: 'ready', label: 'Ready for dispatch' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'completed', label: 'Completed' },
] as const;

const TERMINAL_FAILURE_LABEL: Record<string, string> = {
  cancelled: 'Order cancelled',
  failed: 'Payment failed',
  refunded: 'Order refunded',
};

export interface OrderTimelineProps {
  status: (typeof ORDER_STEPS)[number]['key'] | 'cancelled' | 'failed' | 'refunded';
  timestamps?: Partial<Record<string, string>>;
}

export function OrderTimeline({ status, timestamps = {} }: OrderTimelineProps) {
  const failureLabel = TERMINAL_FAILURE_LABEL[status];
  if (failureLabel) {
    const lastReachedIndex = ORDER_STEPS.findIndex((step) => timestamps[step.key] != null);
    const steps = [
      ...ORDER_STEPS.slice(0, Math.max(lastReachedIndex, 0) + 1).map((step) => ({
        ...step,
        ...(timestamps[step.key] ? { timestamp: timestamps[step.key] } : {}),
      })),
      { key: status, label: failureLabel },
    ];
    return <Timeline steps={steps} currentIndex={steps.length - 1} failed />;
  }

  const currentIndex = ORDER_STEPS.findIndex((step) => step.key === status);
  const steps = ORDER_STEPS.map((step) => ({
    ...step,
    ...(timestamps[step.key] ? { timestamp: timestamps[step.key] } : {}),
  }));
  return <Timeline steps={steps} currentIndex={Math.max(currentIndex, 0)} />;
}
