import { BusinessRuleError, InfrastructureError, err, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/server/auth/session';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
}

const closeConversation = createApiRoute<undefined, unknown, undefined, RouteParams>({
  handler: async ({ params }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();

    const { data: conversation, error: fetchError } = await admin
      .from('support_conversations')
      .select('id, status')
      .eq('id', params.id)
      .maybeSingle();

    if (fetchError) {
      return err(
        new InfrastructureError('Failed to load conversation.', { cause: fetchError.message }),
      );
    }
    if (!conversation)
      return err(new BusinessRuleError('Conversation not found.', { httpStatus: 404 }));
    if (conversation.status === 'closed') {
      return err(new BusinessRuleError('Conversation is already closed.', { httpStatus: 409 }));
    }

    const { error: updateError } = await admin
      .from('support_conversations')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', params.id);
    if (updateError) {
      return err(
        new InfrastructureError('Failed to close conversation.', { cause: updateError.message }),
      );
    }

    await recordAuditEvent({
      eventType: 'support.conversation_closed',
      aggregateType: 'support_conversation',
      aggregateId: params.id,
      actor,
      service: 'support',
    });

    return ok({ closed: true });
  },
});

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return closeConversation(request, await context.params);
}
