import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import Razorpay from 'razorpay';
import { getServerEnv } from '@/config/env';

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
}

/**
 * Ch.16 §135 Razorpay Integration — "Server Only... every payment
 * verified server-side." The only file allowed to import the Razorpay
 * SDK, same discipline as Ch.14 §7's AI provider adapters.
 */
function getClient(): Razorpay {
  const env = getServerEnv();
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET missing).');
  }
  return new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
}

export function isRazorpayConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

/** Ch.8 §92: "Create Razorpay Order" step of the checkout pipeline. Amount is in the smallest currency unit (paise for INR), matching Razorpay's own API contract. */
export async function createRazorpayOrder(params: {
  amountInRupees: number;
  currency?: string;
  receipt: string;
}): Promise<RazorpayOrderResult> {
  const client = getClient();
  const order = await client.orders.create({
    amount: Math.round(params.amountInRupees * 100),
    currency: params.currency ?? 'INR',
    receipt: params.receipt,
  });
  return { id: order.id, amount: Number(order.amount), currency: order.currency };
}

/**
 * Ch.8 §100/§101: "Verify Signature... Never trust frontend callback."
 * Razorpay's checkout.js success callback carries
 * order_id|payment_id + an HMAC-SHA256 signature keyed with the API
 * secret — this recomputes it server-side and compares in constant time.
 */
export function verifyPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const env = getServerEnv();
  if (!env.RAZORPAY_KEY_SECRET) return false;

  const expected = createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest('hex');

  return safeCompare(expected, params.razorpaySignature);
}

/** Ch.16 §136/§148: webhook signature — HMAC-SHA256 over the raw request body, keyed with the separate webhook secret (not the API secret). */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const env = getServerEnv();
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signatureHeader) return false;

  const expected = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return safeCompare(expected, signatureHeader);
}

function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
