import { BusinessRuleError, InfrastructureError, err, ok } from '@prana/core';
import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/server/auth/session';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';
import { sendWhatsAppText } from '@/server/whatsapp/meta-client';

interface RouteParams {
  id: string;
}

const bodySchema = z.object({
  message: z.string().trim().min(1).max(4096),
});

/**
 * The owner's reply from the Support Inbox — this is "managing the
 * number" without a phone, since the dedicated WhatsApp number can't run
 * the regular consumer app once it's API-connected. Only valid on an
 * `escalated` conversation: the bot owns everything before that, and a
 * `closed`/`resolved` conversation has nothing waiting on a human.
 */
const reply = createApiRoute<undefined, unknown, z.infer<typeof bodySchema>, RouteParams>({
  bodySchema,
  handler: async ({ params, body }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();

    const { data: conversation, error: fetchError } = await admin
      .from('support_conversations')
      .select('id, whatsapp_wa_id, status')
      .eq('id', params.id)
      .maybeSingle();

    if (fetchError) {
      return err(
        new InfrastructureError('Failed to load conversation.', { cause: fetchError.message }),
      );
    }
    if (!conversation)
      return err(new BusinessRuleError('Conversation not found.', { httpStatus: 404 }));
    if (conversation.status !== 'escalated') {
      return err(
        new BusinessRuleError(
          'Only an escalated conversation can be replied to from the Support Inbox.',
          {
            httpStatus: 409,
          },
        ),
      );
    }

    try {
      await sendWhatsAppText({ to: conversation.whatsapp_wa_id, body: body.message });
    } catch (cause) {
      return err(
        new InfrastructureError('Failed to send WhatsApp reply.', {
          cause: cause instanceof Error ? cause.message : String(cause),
        }),
      );
    }

    const { error: insertError } = await admin
      .from('support_messages')
      .insert({ conversation_id: params.id, sender: 'owner', body: body.message });
    if (insertError) {
      return err(
        new InfrastructureError('Reply sent but failed to record.', { cause: insertError.message }),
      );
    }

    await recordAuditEvent({
      eventType: 'support.owner_reply',
      aggregateType: 'support_conversation',
      aggregateId: params.id,
      actor,
      service: 'support',
    });

    return ok({ sent: true });
  },
});

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return reply(request, await context.params);
}
