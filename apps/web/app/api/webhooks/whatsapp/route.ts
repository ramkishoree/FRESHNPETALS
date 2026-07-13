import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerEnv } from '@/config/env';
import { logger } from '@/server/logger';

/**
 * This app never processes inbound WhatsApp messages or status updates —
 * the support bot that used to live here was removed at the owner's
 * request (see docs/whatsapp-support.md); the only WhatsApp traffic this
 * app generates is the outbound order-placed alert to the owner
 * (server/support/notify-owner.ts).
 *
 * This endpoint exists solely because Meta's own app-setup wizard
 * requires a webhook callback URL that answers its verification
 * handshake before it lets you continue through "Production setup" —
 * GET answers that handshake, POST just acknowledges receipt of
 * whatever Meta sends (message/status callbacks we never asked for and
 * don't read) so Meta doesn't retry or flag the endpoint as broken.
 */
export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const params = request.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (
    mode === 'subscribe' &&
    challenge &&
    env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN &&
    token === env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  logger.warn('webhook.whatsapp.verification_failed', { mode });
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

export async function POST() {
  return NextResponse.json({ received: true });
}
