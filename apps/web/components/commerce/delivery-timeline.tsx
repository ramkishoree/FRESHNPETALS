import { Timeline } from './timeline';

/** Mirrors infrastructure/database/migrations/0002 `delivery_status`. */
const DELIVERY_STEPS = [
  { key: 'pending', label: 'Preparing for dispatch' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
] as const;

export interface DeliveryTimelineProps {
  status: (typeof DELIVERY_STEPS)[number]['key'] | 'failed';
  timestamps?: Partial<Record<string, string>>;
}

export function DeliveryTimeline({ status, timestamps = {} }: DeliveryTimelineProps) {
  if (status === 'failed') {
    const steps = [
      ...DELIVERY_STEPS.slice(0, 1),
      { key: 'failed', label: 'Delivery attempt failed' },
    ];
    return <Timeline steps={steps} currentIndex={steps.length - 1} failed />;
  }

  const currentIndex = DELIVERY_STEPS.findIndex((step) => step.key === status);
  const steps = DELIVERY_STEPS.map((step) => ({
    ...step,
    ...(timestamps[step.key] ? { timestamp: timestamps[step.key] } : {}),
  }));
  return <Timeline steps={steps} currentIndex={Math.max(currentIndex, 0)} />;
}
