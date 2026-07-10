import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/server/logger';
import { buildAiOrchestrator } from '@/server/ai/build-orchestrator';
import { handleInboundWhatsAppMessage } from '@/server/support/bot-runtime';
import { SupportRepository } from '@/server/support/support-repository';
import {
  parseInboundMessages,
  verifyWhatsAppWebhookSignature,
  verifyWhatsAppWebhookSubscription,
} from '@/server/whatsapp/meta-client';

/**
 * Meta's one-time webhook-URL verification handshake, run when the
 * webhook URL is first registered (and whenever it's re-verified) in
 * Meta App Dashboard → WhatsApp → Configuration.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (verifyWhatsAppWebhookSubscription(mode, token) && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * Inbound message delivery. Same discipline as the Razorpay webhook:
 * verify the raw-body signature before parsing anything, admin client
 * (no user session exists — Meta calls this directly), always ack with
 * 200 once the signature checks out so Meta doesn't retry-storm a
 * request that's already been accepted for processing (an inner failure
 * is logged, not surfaced as a webhook-level error).
 */
export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifyWhatsAppWebhookSignature(rawBody, signature)) {
    logger.warn('webhook.whatsapp.invalid_signature', { correlationId });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    logger.warn('webhook.whatsapp.invalid_json', { correlationId });
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const messages = parseInboundMessages(payload);
  const admin = createSupabaseAdminClient();
  const repo = new SupportRepository(admin);
  const orchestrator = buildAiOrchestrator(admin);

  for (const message of messages) {
    try {
      await handleInboundWhatsAppMessage({ repo, orchestrator }, message);
    } catch (cause) {
      logger.error('webhook.whatsapp.processing_failed', {
        correlationId,
        waId: message.waId,
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  return NextResponse.json({ received: true });
}
