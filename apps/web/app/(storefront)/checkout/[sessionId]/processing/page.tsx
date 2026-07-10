'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { Spinner } from '@/components/states/spinner';

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 30; // 60 seconds

/**
 * Ch.8 §89 Principle 5 + §99 Payment Flow: order creation happens only
 * from the verified webhook, asynchronously relative to the customer's
 * browser. This page is what "wait for the webhook" looks like from the
 * customer's side — polling rather than trusting anything the Razorpay
 * success handler said client-side.
 */
export default function CheckoutProcessingPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [pollCount, setPollCount] = React.useState(0);
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function poll() {
      const response = await fetch(`/api/v1/checkout/${params.sessionId}/status`);
      const body = await response.json();
      if (cancelled) return;

      if (response.ok && body.success && body.data.status === 'completed' && body.data.orderId) {
        router.push(`/account/orders/${body.data.orderId}`);
        return;
      }

      if (response.ok && body.success && ['cancelled', 'expired'].includes(body.data.status)) {
        router.push('/cart');
        return;
      }

      if (pollCount >= MAX_POLLS) {
        setTimedOut(true);
        return;
      }

      setTimeout(() => setPollCount((count) => count + 1), POLL_INTERVAL_MS);
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [pollCount, params.sessionId, router]);

  if (timedOut) {
    return (
      <div className="container-brand flex flex-col items-center gap-4 py-24 text-center">
        <h1 className="text-h2 text-foreground font-bold">Still confirming your payment</h1>
        <p className="text-body text-muted-foreground max-w-md">
          This is taking longer than expected. Check{' '}
          <Link href="/account/orders" className="text-primary underline underline-offset-2">
            My Orders
          </Link>{' '}
          in a few minutes — your payment provider may still be finalizing it.
        </p>
      </div>
    );
  }

  return (
    <div className="container-brand flex flex-col items-center gap-4 py-24 text-center">
      <Spinner />
      <h1 className="text-h2 text-foreground font-bold">Confirming your payment...</h1>
      <p className="text-body text-muted-foreground">This usually takes just a few seconds.</p>
    </div>
  );
}
