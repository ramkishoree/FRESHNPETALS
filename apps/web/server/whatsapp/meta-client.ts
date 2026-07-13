import 'server-only';
import { getServerEnv } from '@/config/env';

/**
 * Meta WhatsApp Cloud API — direct integration, no BSP (Twilio/Gupshup/
 * AiSensy) in between. Cheapest ongoing cost (Meta's own per-message rate
 * only). Owner's call after removing the WhatsApp support bot: this file
 * now only ever sends the order-placed alert to the owner — no inbound
 * webhook, no customer-facing bot number, no signature verification for
 * messages this app never receives anymore.
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
 * Business-initiated message — the order-placed alert. Meta requires a
 * pre-approved template outside the 24h customer-service window (this
 * is never a reply to an inbound message, so it always needs one).
 * `bodyParams` fill the template's `{{1}}`, `{{2}}`... placeholders in
 * order.
 */
export async function sendWhatsAppTemplate(params: {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams?: string[];
  /** Public HTTPS image URL for a template with a HEADER IMAGE component
   *  (e.g. the first item's product photo). Omit entirely if the
   *  template has no image header, or Meta rejects the send. */
  headerImageUrl?: string;
}): Promise<SendResult> {
  const components = [
    ...(params.headerImageUrl
      ? [
          {
            type: 'header',
            parameters: [{ type: 'image', image: { link: params.headerImageUrl } }],
          },
        ]
      : []),
    ...(params.bodyParams && params.bodyParams.length > 0
      ? [
          {
            type: 'body',
            parameters: params.bodyParams.map((text) => ({ type: 'text', text })),
          },
        ]
      : []),
  ];

  return callSendApi({
    to: params.to,
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: params.languageCode ?? 'en' },
      ...(components.length > 0 ? { components } : {}),
    },
  });
}
