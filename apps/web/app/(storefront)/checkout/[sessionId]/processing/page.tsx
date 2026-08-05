'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { BrandDivider } from '@/components/storefront/brand-divider';

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 30; // 60 seconds
/**
 * When Razorpay told the browser the attempt failed, the wait is much
 * shorter before offering a retry. A failed attempt deliberately leaves
 * the session open (a later attempt on the same order can still
 * succeed), so there is no terminal status coming — waiting the full
 * minute only strands the customer. Polling continues underneath either
 * way, because a "failure" the bank actually captured still resolves to
 * the order confirmation.
 */
const MAX_POLLS_AFTER_FAILED_ATTEMPT = 5; // 10 seconds

/**
 * Ch.8 §89 Principle 5 + §99 Payment Flow: order creation happens only
 * from the verified webhook, asynchronously relative to the customer's
 * browser. This page is what "wait for the webhook" looks like from the
 * customer's side — polling rather than trusting anything the Razorpay
 * success handler said client-side.
 */
export default function CheckoutProcessingPage() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pollCount, setPollCount] = React.useState(0);
  const [timedOut, setTimedOut] = React.useState(false);

  const attemptFailed = searchParams.get('attempt') === 'failed';
  const maxPolls = attemptFailed ? MAX_POLLS_AFTER_FAILED_ATTEMPT : MAX_POLLS;

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

      if (pollCount >= maxPolls) {
        setTimedOut(true);
        return;
      }

      setTimeout(() => setPollCount((count) => count + 1), POLL_INTERVAL_MS);
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [pollCount, params.sessionId, router, maxPolls]);

  return (
    <div className="container-brand grid min-h-[70vh] place-items-center py-16 text-center">
      <div className="max-w-md">
        {!timedOut ? (
          <>
            <div
              className="mx-auto size-14 animate-spin rounded-full border-2 border-[var(--sf-border)] border-t-[var(--gold)]"
              style={{ animationDuration: '1.1s' }}
              aria-hidden="true"
            />
            <p className="eyebrow mt-8">Confirming your order</p>
            <h1 className="text-h2 mt-3">Arranging your order</h1>
            <p className="text-body-lg mt-3">
              We&rsquo;re confirming your payment with the bank. This usually takes a few seconds —
              please don&rsquo;t close this window.
            </p>
            <BrandDivider className="mt-8" />
          </>
        ) : attemptFailed ? (
          <>
            <p className="eyebrow">Payment not completed</p>
            <h1 className="text-h2 mt-3">That payment didn&rsquo;t go through</h1>
            <p className="text-body-lg mt-3">
              Your bank declined the payment or it was cancelled, so no order was placed and you
              haven&rsquo;t been charged. Your basket is exactly as you left it — you can try again
              with the same or a different payment method.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href={`/checkout?retry=${params.sessionId}`}
                className="bg-foreground text-background rounded-full px-6 py-3 text-sm font-medium"
              >
                Try payment again
              </Link>
              <Link
                href="/cart"
                className="text-foreground rounded-full border border-[var(--sf-border)] px-6 py-3 text-sm font-medium"
              >
                Back to basket
              </Link>
            </div>
            <p className="text-caption text-muted-foreground mt-6">
              If your bank did take the money, it will appear in{' '}
              <Link
                href="/account/orders"
                className="text-[var(--gold-deep)] underline underline-offset-2"
              >
                My Orders
              </Link>{' '}
              shortly — don&rsquo;t pay twice.
            </p>
            <BrandDivider className="my-8" />
          </>
        ) : (
          <>
            <p className="eyebrow">Taking a moment longer</p>
            <h1 className="text-h2 mt-3">Still confirming</h1>
            <p className="text-body-lg mt-3">
              This is taking longer than expected. Your payment provider may still be finalizing it
              — don&rsquo;t pay again until you&rsquo;ve checked.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/account/orders"
                className="bg-foreground text-background rounded-full px-6 py-3 text-sm font-medium"
              >
                Check My Orders
              </Link>
              <Link
                href="/cart"
                className="text-foreground rounded-full border border-[var(--sf-border)] px-6 py-3 text-sm font-medium"
              >
                Back to basket
              </Link>
            </div>
            <BrandDivider className="my-8" />
          </>
        )}
      </div>
    </div>
  );
}
