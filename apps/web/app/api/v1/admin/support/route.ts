import { InfrastructureError, err, ok } from '@prana/core';
import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

const querySchema = z.object({
  status: z.enum(['bot_active', 'resolved', 'escalated', 'closed']).optional(),
});

/** Support Inbox list — Ch.16-style admin listing, same shape as the Approval Queue's GET. */
const listConversations = createApiRoute({
  querySchema,
  handler: async ({ query }) => {
    const admin = createSupabaseAdminClient();
    let queryBuilder = admin
      .from('support_conversations')
      .select(
        'id, whatsapp_wa_id, status, ai_attempt_count, escalated_at, order_id, orders(order_number), updated_at',
      )
      .order('updated_at', { ascending: false })
      .limit(100);

    if (query.status) queryBuilder = queryBuilder.eq('status', query.status);

    const { data, error } = await queryBuilder;
    if (error)
      return err(
        new InfrastructureError('Failed to load conversations.', { cause: error.message }),
      );
    return ok(data ?? []);
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return listConversations(request);
}
