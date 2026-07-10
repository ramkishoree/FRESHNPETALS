import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { CurrentUser } from '@/server/auth/session';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface RecordAuditEventInput {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  actor: CurrentUser;
  service: string;
  previous?: unknown;
  next?: unknown;
  severity?: AuditSeverity;
  request?: Request;
  correlationId?: string;
}

/**
 * Ch.8 §117 (Audit Domain) + Ch.16 §111 (Audit Log API): "every critical
 * business action must generate an immutable audit record". `event_store`
 * (Ch.10 §117) is that platform-wide immutable backbone — see migration
 * 0023's rationale for why this writes there instead of a parallel table.
 *
 * Uses the service-role client deliberately: `event_store`'s RLS
 * (migration 0015) only grants `authenticated` a SELECT policy, so an
 * INSERT under the caller's own session would be denied by RLS — audit
 * records must not be fabricatable by the actor they describe, only by
 * trusted server code recording what actually happened.
 */
export async function recordAuditEvent(input: RecordAuditEventInput): Promise<void> {
  const admin = createSupabaseAdminClient();

  const forwardedFor = input.request?.headers.get('x-forwarded-for');
  const actorIp = forwardedFor?.split(',')[0]?.trim() ?? null;
  const userAgent = input.request?.headers.get('user-agent') ?? null;

  const { error } = await admin.from('event_store').insert({
    event_type: input.eventType,
    aggregate_type: input.aggregateType,
    aggregate_id: input.aggregateId,
    actor_id: input.actor.id,
    actor_ip: actorIp,
    user_agent: userAgent,
    severity: input.severity ?? 'info',
    service: input.service,
    correlation_id: input.correlationId ?? null,
    payload: {
      previous: input.previous ?? null,
      next: input.next ?? null,
    },
    metadata: {
      actorEmail: input.actor.email,
      actorRoles: input.actor.roles,
    },
  });

  if (error) throw new Error(`Failed to record audit event: ${error.message}`);
}
