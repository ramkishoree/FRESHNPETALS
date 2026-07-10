import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getServerEnv } from '@/config/env';

/**
 * Meta WhatsApp Cloud API — direct integration, no BSP (Twilio/Gupshup/
 * AiSensy) in between. Cheapest ongoing cost (Meta's own per-message rate
 * only), at the price of doing template submission and webhook signature
 * verification ourselves instead of a vendor dashboard handling it.
 *
 * The only file allowed to talk to graph.facebook.com, same discipline as
 * razorpay-adapter.ts for Razorpay and the Ch.14 §7 AI provider adapters.
 */
const GRAPH_API_VERSION = 'v21.0';

export function isWhatsAppConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.META_WHATSAPP_ACCESS_TOKEN && env.META_WHATSAPP_PHONE_NUMBER_ID);
}

interface SendResult {
  messageId: string;
}

async function callSendApi(body: Record<string, unknown>): Promise<SendResult> {
  const env = getServerEnv();
  if (!env.META_WHATSAPP_ACCESS_TOKEN || !env.META_WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error(
      'WhatsApp is not configured (META_WHATSAPP_ACCESS_TOKEN/META_WHATSAPP_PHONE_NUMBER_ID missing).',
    );
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.META_WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.META_WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message ?? `WhatsApp send failed (${response.status})`;
    throw new Error(message);
  }

  const messageId = payload?.messages?.[0]?.id;
  if (!messageId) throw new Error('WhatsApp send succeeded but returned no message id.');
  return { messageId };
}

/**
 * Business-initiated message — order alerts, escalation notices. Meta
 * requires a pre-approved template outside the 24h customer-service
 * window (the owner's alert is never a reply to an inbound message, so
 * it always needs a template). `bodyParams` fill the template's `{{1}}`,
 * `{{2}}`... placeholders in order.
 */
export async function sendWhatsAppTemplate(params: {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams?: string[];
}): Promise<SendResult> {
  return callSendApi({
    to: params.to,
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: params.languageCode ?? 'en' },
      ...(params.bodyParams && params.bodyParams.length > 0
        ? {
            components: [
              {
                type: 'body',
                parameters: params.bodyParams.map((text) => ({ type: 'text', text })),
              },
            ],
          }
        : {}),
    },
  });
}

/**
 * Free-form reply — only valid inside the 24h customer-service window
 * (i.e. replying to a message the customer sent). The bot's replies and
 * the owner's Support Inbox replies both use this; the order-placed and
 * escalation alerts (unprompted) must use `sendWhatsAppTemplate` instead.
 */
export async function sendWhatsAppText(params: { to: string; body: string }): Promise<SendResult> {
  return callSendApi({
    to: params.to,
    type: 'text',
    text: { body: params.body },
  });
}

/**
 * Ch.16-style webhook signature check (same shape as Razorpay's): Meta
 * signs every webhook delivery with `X-Hub-Signature-256: sha256=<hex>`,
 * HMAC-SHA256 over the *raw* request body, keyed with the Meta App's App
 * Secret (not the access token — a separate value from the App Dashboard).
 */
export function verifyWhatsAppWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const env = getServerEnv();
  if (!env.META_WHATSAPP_APP_SECRET || !signatureHeader) return false;

  const prefix = 'sha256=';
  if (!signatureHeader.startsWith(prefix)) return false;
  const providedHex = signatureHeader.slice(prefix.length);

  const expectedHex = createHmac('sha256', env.META_WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const providedBuf = Buffer.from(providedHex, 'hex');
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

/** Meta's one-time webhook-URL verification handshake (GET request). */
export function verifyWhatsAppWebhookSubscription(
  mode: string | null,
  token: string | null,
): boolean {
  const env = getServerEnv();
  if (!env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN) return false;
  return mode === 'subscribe' && token === env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN;
}

/** Shape of Meta's inbound webhook POST body, narrowed to what we use. */
export interface WhatsAppInboundMessage {
  waId: string;
  messageId: string;
  body: string;
  timestamp: string;
}

export function parseInboundMessages(payload: unknown): WhatsAppInboundMessage[] {
  const messages: WhatsAppInboundMessage[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value;
      const rawMessages = (value?.['messages'] as unknown[]) ?? [];
      for (const raw of rawMessages) {
        const message = raw as {
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        };
        if (message.type !== 'text' || !message.from || !message.id || !message.text?.body)
          continue;
        messages.push({
          waId: message.from,
          messageId: message.id,
          body: message.text.body,
          timestamp: message.timestamp ?? new Date().toISOString(),
        });
      }
    }
  }

  return messages;
}
