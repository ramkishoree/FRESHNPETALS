import { BusinessRuleError, InfrastructureError, err, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
}

const getConversation = createApiRoute<undefined, unknown, undefined, RouteParams>({
  handler: async ({ params }) => {
    const admin = createSupabaseAdminClient();

    const { data: conversation, error: conversationError } = await admin
      .from('support_conversations')
      .select(
        'id, whatsapp_wa_id, status, ai_attempt_count, escalated_at, order_id, orders(order_number)',
      )
      .eq('id', params.id)
      .maybeSingle();

    if (conversationError) {
      return err(
        new InfrastructureError('Failed to load conversation.', {
          cause: conversationError.message,
        }),
      );
    }
    if (!conversation)
      return err(new BusinessRuleError('Conversation not found.', { httpStatus: 404 }));

    const { data: messages, error: messagesError } = await admin
      .from('support_messages')
      .select('id, sender, body, created_at')
      .eq('conversation_id', params.id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      return err(
        new InfrastructureError('Failed to load messages.', { cause: messagesError.message }),
      );
    }

    return ok({ conversation, messages: messages ?? [] });
  },
});

export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return getConversation(request, await context.params);
}
