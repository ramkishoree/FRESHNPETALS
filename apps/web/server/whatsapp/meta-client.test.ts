// @vitest-environment node
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadClient() {
  vi.resetModules();
  return import('./meta-client');
}

describe('meta-client webhook verification', () => {
  beforeEach(() => {
    process.env['META_WHATSAPP_APP_SECRET'] = 'test_app_secret';
    process.env['META_WHATSAPP_WEBHOOK_VERIFY_TOKEN'] = 'test_verify_token';
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

  it('accepts a correctly-computed X-Hub-Signature-256 over the raw body', async () => {
    const { verifyWhatsAppWebhookSignature } = await loadClient();
    const rawBody = JSON.stringify({ object: 'whatsapp_business_account' });
    const signature = `sha256=${createHmac('sha256', 'test_app_secret').update(rawBody).digest('hex')}`;

    expect(verifyWhatsAppWebhookSignature(rawBody, signature)).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const { verifyWhatsAppWebhookSignature } = await loadClient();
    const signature = `sha256=${createHmac('sha256', 'test_app_secret').update('{"a":1}').digest('hex')}`;

    expect(verifyWhatsAppWebhookSignature('{"a":2}', signature)).toBe(false);
  });

  it('rejects a missing signature header', async () => {
    const { verifyWhatsAppWebhookSignature } = await loadClient();
    expect(verifyWhatsAppWebhookSignature('{}', null)).toBe(false);
  });

  it('rejects a signature missing the sha256= prefix', async () => {
    const { verifyWhatsAppWebhookSignature } = await loadClient();
    const rawBody = '{}';
    const bareHex = createHmac('sha256', 'test_app_secret').update(rawBody).digest('hex');
    expect(verifyWhatsAppWebhookSignature(rawBody, bareHex)).toBe(false);
  });

  it('confirms the Meta webhook subscription handshake with a matching token', async () => {
    const { verifyWhatsAppWebhookSubscription } = await loadClient();
    expect(verifyWhatsAppWebhookSubscription('subscribe', 'test_verify_token')).toBe(true);
  });

  it('rejects the handshake with a wrong token or mode', async () => {
    const { verifyWhatsAppWebhookSubscription } = await loadClient();
    expect(verifyWhatsAppWebhookSubscription('subscribe', 'wrong_token')).toBe(false);
    expect(verifyWhatsAppWebhookSubscription('unsubscribe', 'test_verify_token')).toBe(false);
  });

  it('reports not configured when access token/phone number id are absent', async () => {
    const { isWhatsAppConfigured } = await loadClient();
    expect(isWhatsAppConfigured()).toBe(false);
  });

  it('reports configured once access token and phone number id are present', async () => {
    process.env['META_WHATSAPP_ACCESS_TOKEN'] = 'token';
    process.env['META_WHATSAPP_PHONE_NUMBER_ID'] = '123456';
    const { isWhatsAppConfigured } = await loadClient();
    expect(isWhatsAppConfigured()).toBe(true);
  });
});

describe('parseInboundMessages', () => {
  it('extracts text messages from a real-shaped Meta webhook payload', async () => {
    const { parseInboundMessages } = await loadClient();
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-id',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: '123' },
                contacts: [{ profile: { name: 'Test Customer' }, wa_id: '911234567890' }],
                messages: [
                  {
                    from: '911234567890',
                    id: 'wamid.abc123',
                    timestamp: '1710000000',
                    type: 'text',
                    text: { body: 'Where is my order?' },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    const messages = parseInboundMessages(payload);
    expect(messages).toEqual([
      {
        waId: '911234567890',
        messageId: 'wamid.abc123',
        body: 'Where is my order?',
        timestamp: '1710000000',
      },
    ]);
  });

  it('ignores non-text messages (e.g. status updates, images) without throwing', async () => {
    const { parseInboundMessages } = await loadClient();
    const payload = {
      entry: [
        {
          changes: [
            { value: { statuses: [{ id: 'wamid.x', status: 'delivered' }] }, field: 'messages' },
          ],
        },
      ],
    };

    expect(parseInboundMessages(payload)).toEqual([]);
  });

  it('returns an empty array for a malformed/unexpected payload shape', async () => {
    const { parseInboundMessages } = await loadClient();
    expect(parseInboundMessages({})).toEqual([]);
    expect(parseInboundMessages(null)).toEqual([]);
  });
});
