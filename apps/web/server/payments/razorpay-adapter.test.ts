// @vitest-environment node
//
// getServerEnv() hard-fails when `typeof window !== 'undefined'` — a real
// guard against this server-only module ever running client-side. The
// project's default Vitest environment is jsdom (which defines `window`
// even for a server-side test file), so this one file opts into the
// `node` environment instead of working around its own safety check.
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadAdapter() {
  vi.resetModules();
  return import('./razorpay-adapter');
}

describe('razorpay-adapter signature verification', () => {
  beforeEach(() => {
    process.env['RAZORPAY_KEY_SECRET'] = 'test_key_secret';
    process.env['RAZORPAY_WEBHOOK_SECRET'] = 'test_webhook_secret';
    process.env['NEXT_PUBLIC_APP_URL'] = 'http://localhost:3100';
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'http://localhost:54321';
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = 'anon';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service';
    process.env['UPSTASH_REDIS_REST_URL'] = 'http://localhost:8079';
    process.env['UPSTASH_REDIS_REST_TOKEN'] = 'token';
    process.env['CRON_SECRET'] = 'secret';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('accepts a correctly-computed payment signature', async () => {
    const { verifyPaymentSignature } = await loadAdapter();
    const razorpayOrderId = 'order_123';
    const razorpayPaymentId = 'pay_456';
    const signature = createHmac('sha256', 'test_key_secret')
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    expect(
      verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature: signature }),
    ).toBe(true);
  });

  it('rejects a tampered payment signature', async () => {
    const { verifyPaymentSignature } = await loadAdapter();

    expect(
      verifyPaymentSignature({
        razorpayOrderId: 'order_123',
        razorpayPaymentId: 'pay_456',
        razorpaySignature: 'not-the-real-signature',
      }),
    ).toBe(false);
  });

  it('rejects a signature computed with the wrong order/payment id (replay against a different transaction)', async () => {
    const { verifyPaymentSignature } = await loadAdapter();
    const signature = createHmac('sha256', 'test_key_secret')
      .update('order_999|pay_999')
      .digest('hex');

    expect(
      verifyPaymentSignature({
        razorpayOrderId: 'order_123',
        razorpayPaymentId: 'pay_456',
        razorpaySignature: signature,
      }),
    ).toBe(false);
  });

  it('accepts a correctly-computed webhook signature over the raw body', async () => {
    const { verifyWebhookSignature } = await loadAdapter();
    const rawBody = JSON.stringify({ event: 'payment.captured' });
    const signature = createHmac('sha256', 'test_webhook_secret').update(rawBody).digest('hex');

    expect(verifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  it('rejects a webhook body that does not match its signature', async () => {
    const { verifyWebhookSignature } = await loadAdapter();
    const signature = createHmac('sha256', 'test_webhook_secret')
      .update('{"event":"original"}')
      .digest('hex');

    expect(verifyWebhookSignature('{"event":"tampered"}', signature)).toBe(false);
  });

  it('rejects a missing webhook signature header', async () => {
    const { verifyWebhookSignature } = await loadAdapter();
    expect(verifyWebhookSignature('{}', null)).toBe(false);
  });

  it('reports not configured when secrets are absent', async () => {
    delete process.env['RAZORPAY_KEY_ID'];
    delete process.env['RAZORPAY_KEY_SECRET'];
    const { isRazorpayConfigured } = await loadAdapter();
    expect(isRazorpayConfigured()).toBe(false);
  });
});
