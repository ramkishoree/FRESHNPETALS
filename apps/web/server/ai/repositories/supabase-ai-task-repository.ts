import type { SupabaseClient } from '@supabase/supabase-js';

export type AiTaskStatus =
  'queued' | 'running' | 'waiting_approval' | 'completed' | 'rejected' | 'cancelled' | 'failed';

export interface AiTaskRow {
  id: string;
  taskType: string;
  title: string;
  description: string | null;
  status: AiTaskStatus;
  assignedAgent: string | null;
  agentName: string | null;
  agentSlug: string | null;
  requestedBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt: string | null;
}

interface AiTaskSelectRow {
  id: string;
  task_type: string;
  title: string;
  description: string | null;
  status: AiTaskStatus;
  assigned_agent: string | null;
  requested_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
  ai_agents: { name: string; slug: string } | { name: string; slug: string }[] | null;
}

function mapRow(row: AiTaskSelectRow): AiTaskRow {
  const agent = Array.isArray(row.ai_agents) ? row.ai_agents[0] : row.ai_agents;
  return {
    id: row.id,
    taskType: row.task_type,
    title: row.title,
    description: row.description,
    status: row.status,
    assignedAgent: row.assigned_agent,
    agentName: agent?.name ?? null,
    agentSlug: agent?.slug ?? null,
    requestedBy: row.requested_by,
    metadata: row.metadata,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

const SELECT_COLUMNS =
  'id, task_type, title, description, status, assigned_agent, requested_by, metadata, created_at, completed_at, ai_agents(name, slug)';

/**
 * Ch.9 §34 Task Lifecycle + Ch.16 §119 AI Task Queue API. `ai_tasks` is
 * the Approval Queue itself once filtered to `waiting_approval` — no
 * separate queue table exists or is needed.
 */
export class SupabaseAiTaskRepository {
  constructor(private readonly client: SupabaseClient) {}

  async resolveAgentId(slug: string): Promise<string | null> {
    const { data, error } = await this.client
      .from('ai_agents')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.id as string | undefined) ?? null;
  }

  async create(input: {
    taskType: string;
    title: string;
    description?: string;
    assignedAgent: string;
    requestedBy?: string;
    riskLevel?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const { data, error } = await this.client
      .from('ai_tasks')
      .insert({
        task_type: input.taskType,
        title: input.title,
        description: input.description ?? null,
        status: 'running',
        assigned_agent: input.assignedAgent,
        requested_by: input.requestedBy ?? null,
        approval_required: true,
        started_at: new Date().toISOString(),
        metadata: input.metadata ?? {},
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  async markWaitingApproval(taskId: string, metadata: Record<string, unknown>): Promise<void> {
    const { error } = await this.client
      .from('ai_tasks')
      .update({ status: 'waiting_approval', metadata })
      .eq('id', taskId);
    if (error) throw new Error(error.message);
  }

  async markFailed(taskId: string, reason: string): Promise<void> {
    const { error } = await this.client
      .from('ai_tasks')
      .update({
        status: 'failed',
        metadata: { error: reason },
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);
    if (error) throw new Error(error.message);
  }

  async cancel(taskId: string): Promise<void> {
    const { error } = await this.client
      .from('ai_tasks')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', taskId);
    if (error) throw new Error(error.message);
  }

  async findById(taskId: string): Promise<AiTaskRow | null> {
    const { data, error } = await this.client
      .from('ai_tasks')
      .select(SELECT_COLUMNS)
      .eq('id', taskId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(data as unknown as AiTaskSelectRow) : null;
  }

  async list(options: {
    status?: AiTaskStatus;
    agentSlug?: string;
    limit?: number;
  }): Promise<AiTaskRow[]> {
    let query = this.client
      .from('ai_tasks')
      .select(SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(options.limit ?? 50);

    if (options.status) query = query.eq('status', options.status);
    if (options.agentSlug) query = query.eq('ai_agents.slug', options.agentSlug);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as AiTaskSelectRow[]).map(mapRow);
  }
}
