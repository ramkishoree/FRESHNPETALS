import type { SupabaseClient } from '@supabase/supabase-js';

export type AiApprovalDecision = 'approved' | 'rejected' | 'edited' | 'deferred';

/**
 * Ch.9 §11/§49 Approval Queue. Recording a decision and advancing the
 * task's status must happen atomically (migration 0040's
 * `ai_approval_decide` RPC) — same PostgREST-has-no-cross-call-
 * atomicity rule as every other multi-table write in this project.
 */
export class SupabaseAiApprovalRepository {
  constructor(private readonly client: SupabaseClient) {}

  async decide(input: {
    taskId: string;
    decision: AiApprovalDecision;
    approverId: string;
    reason?: string;
    editedOutput?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.client.rpc('ai_approval_decide', {
      p_task_id: input.taskId,
      p_decision: input.decision,
      p_approver: input.approverId,
      p_reason: input.reason ?? null,
      p_edited_output: input.editedOutput ?? null,
    });
    if (error) throw new Error(error.message);
  }
}
