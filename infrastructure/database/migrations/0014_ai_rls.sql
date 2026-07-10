-- RLS — AI Domain. Entirely internal/operational: no anon or customer
-- access to any table in this file, ever. Config tables (agents,
-- capabilities, tools, prompts, workflows) are admin read/write for the AI
-- Workspace dashboard. Pure operational logs (memory, embeddings, knowledge
-- graph, context cache, cost tracking, feedback, audit log) are admin
-- read-only — the AI system itself writes them via the backend's
-- service_role, never through a client-facing role.

create policy ai_agents_admin_all on public.ai_agents
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.ai_agents enable row level security;
alter table public.ai_agents force row level security;

create policy ai_capabilities_admin_all on public.ai_capabilities
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.ai_capabilities enable row level security;
alter table public.ai_capabilities force row level security;

create policy ai_agent_capabilities_admin_all on public.ai_agent_capabilities
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.ai_agent_capabilities enable row level security;
alter table public.ai_agent_capabilities force row level security;

create policy ai_tools_admin_all on public.ai_tools
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.ai_tools enable row level security;
alter table public.ai_tools force row level security;

create policy ai_agent_tools_admin_all on public.ai_agent_tools
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.ai_agent_tools enable row level security;
alter table public.ai_agent_tools force row level security;

create policy ai_prompts_admin_all on public.ai_prompts
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.ai_prompts enable row level security;
alter table public.ai_prompts force row level security;

-- ai_prompt_versions: immutable — admin may create and read, never
-- update/delete a published version (§95 "No prompt is ever overwritten").
create policy ai_prompt_versions_select_admin on public.ai_prompt_versions
  for select to authenticated using (private.is_admin());
create policy ai_prompt_versions_insert_admin on public.ai_prompt_versions
  for insert to authenticated with check (private.is_admin());
alter table public.ai_prompt_versions enable row level security;
alter table public.ai_prompt_versions force row level security;

create policy ai_tasks_admin_all on public.ai_tasks
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.ai_tasks enable row level security;
alter table public.ai_tasks force row level security;

create policy ai_workflows_admin_all on public.ai_workflows
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.ai_workflows enable row level security;
alter table public.ai_workflows force row level security;

create policy ai_workflow_steps_admin_all on public.ai_workflow_steps
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.ai_workflow_steps enable row level security;
alter table public.ai_workflow_steps force row level security;

create policy ai_workflow_runs_select_admin on public.ai_workflow_runs
  for select to authenticated using (private.is_admin());
alter table public.ai_workflow_runs enable row level security;
alter table public.ai_workflow_runs force row level security;

-- ai_approvals: admin records their decision (insert) and reads history.
create policy ai_approvals_select_admin on public.ai_approvals
  for select to authenticated using (private.is_admin());
create policy ai_approvals_insert_admin on public.ai_approvals
  for insert to authenticated with check (private.is_admin() and approver = auth.uid());
alter table public.ai_approvals enable row level security;
alter table public.ai_approvals force row level security;

create policy business_memory_select_admin on public.business_memory
  for select to authenticated using (private.is_admin());
alter table public.business_memory enable row level security;
alter table public.business_memory force row level security;

create policy embeddings_select_admin on public.embeddings
  for select to authenticated using (private.is_admin());
alter table public.embeddings enable row level security;
alter table public.embeddings force row level security;

create policy kg_nodes_select_admin on public.knowledge_graph_nodes
  for select to authenticated using (private.is_admin());
alter table public.knowledge_graph_nodes enable row level security;
alter table public.knowledge_graph_nodes force row level security;

create policy kg_edges_select_admin on public.knowledge_graph_edges
  for select to authenticated using (private.is_admin());
alter table public.knowledge_graph_edges enable row level security;
alter table public.knowledge_graph_edges force row level security;

create policy context_cache_select_admin on public.context_cache
  for select to authenticated using (private.is_admin());
alter table public.context_cache enable row level security;
alter table public.context_cache force row level security;

create policy ai_cost_tracking_select_admin on public.ai_cost_tracking
  for select to authenticated using (private.is_admin());
alter table public.ai_cost_tracking enable row level security;
alter table public.ai_cost_tracking force row level security;

create policy ai_feedback_select_admin on public.ai_feedback
  for select to authenticated using (private.is_admin());
create policy ai_feedback_insert_admin on public.ai_feedback
  for insert to authenticated with check (private.is_admin());
alter table public.ai_feedback enable row level security;
alter table public.ai_feedback force row level security;

create policy ai_audit_log_select_admin on public.ai_audit_log
  for select to authenticated using (private.is_admin());
alter table public.ai_audit_log enable row level security;
alter table public.ai_audit_log force row level security;
