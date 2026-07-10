-- AI Domain — Handbook Ch.10 Part 5 (§87-113). Structural only: this phase
-- (Database Foundation) creates the persistence layer. No AI employees are
-- seeded or implemented here — that's Phase 6 (AI Foundation) and Phase 11
-- (AI Employees) per the canonical roadmap.

create table public.ai_agents (
  id uuid primary key default uuid_generate_v7(),
  name text not null,
  slug text not null unique,
  description text,
  version integer not null default 1,
  status ai_agent_status not null default 'active',
  preferred_model text,
  fallback_model text,
  temperature numeric(3, 2) not null default 0.7,
  max_tokens integer,
  owner uuid references public.users (id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ai_agents_slug on public.ai_agents (slug);
create index idx_ai_agents_status on public.ai_agents (status);
create trigger trg_touch_row before update on public.ai_agents
  for each row execute function private.touch_row();

create table public.ai_capabilities (
  id uuid primary key default uuid_generate_v7(),
  name text not null unique,
  description text,
  category text,
  risk_level ai_risk_level not null default 'advisory',
  approval_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_touch_row before update on public.ai_capabilities
  for each row execute function private.touch_row();

create table public.ai_agent_capabilities (
  agent_id uuid not null references public.ai_agents (id) on delete cascade,
  capability_id uuid not null references public.ai_capabilities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agent_id, capability_id)
);

create table public.ai_tools (
  id uuid primary key default uuid_generate_v7(),
  name text not null unique,
  description text,
  tool_type text,
  permission_level text,
  danger_level ai_risk_level not null default 'operational',
  input_schema jsonb not null default '{}',
  output_schema jsonb not null default '{}',
  timeout_seconds integer not null default 30,
  retry_limit integer not null default 3,
  active boolean not null default true,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_touch_row before update on public.ai_tools
  for each row execute function private.touch_row();

create table public.ai_agent_tools (
  agent_id uuid not null references public.ai_agents (id) on delete cascade,
  tool_id uuid not null references public.ai_tools (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agent_id, tool_id)
);

create table public.ai_prompts (
  id uuid primary key default uuid_generate_v7(),
  name text not null unique,
  purpose text,
  current_version integer not null default 1,
  owner uuid references public.users (id),
  status ai_prompt_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_touch_row before update on public.ai_prompts
  for each row execute function private.touch_row();

-- ai_prompt_versions — §95. Immutable; rollback = pointing current_version
-- at an older row, never editing one.
create table public.ai_prompt_versions (
  id uuid primary key default uuid_generate_v7(),
  prompt_id uuid not null references public.ai_prompts (id) on delete cascade,
  version integer not null,
  model_family text,
  system_prompt text not null,
  developer_prompt text,
  expected_output_schema jsonb,
  created_by uuid references public.users (id),
  approved_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  unique (prompt_id, version)
);

create index idx_ai_prompt_versions_prompt_id on public.ai_prompt_versions (prompt_id);

create table public.ai_tasks (
  id uuid primary key default uuid_generate_v7(),
  task_type text not null,
  title text not null,
  description text,
  priority job_priority not null default 'medium',
  status ai_task_status not null default 'queued',
  risk_level ai_risk_level not null default 'advisory',
  requested_by uuid references public.users (id),
  assigned_agent uuid references public.ai_agents (id),
  approval_required boolean not null default false,
  deadline timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ai_tasks_status on public.ai_tasks (status);
create index idx_ai_tasks_assigned_agent on public.ai_tasks (assigned_agent);
create index idx_ai_tasks_created_at on public.ai_tasks (created_at desc);
create trigger trg_touch_row before update on public.ai_tasks
  for each row execute function private.touch_row();

create table public.ai_workflows (
  id uuid primary key default uuid_generate_v7(),
  name text not null unique,
  description text,
  trigger jsonb not null default '{}',
  active boolean not null default true,
  version integer not null default 1,
  owner uuid references public.users (id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_touch_row before update on public.ai_workflows
  for each row execute function private.touch_row();

create table public.ai_workflow_steps (
  id uuid primary key default uuid_generate_v7(),
  workflow_id uuid not null references public.ai_workflows (id) on delete cascade,
  step_number integer not null,
  agent uuid references public.ai_agents (id),
  tool uuid references public.ai_tools (id),
  input_mapping jsonb not null default '{}',
  output_mapping jsonb not null default '{}',
  retry_policy jsonb not null default '{}',
  timeout_seconds integer not null default 60,
  approval_required boolean not null default false,
  unique (workflow_id, step_number)
);

create table public.ai_workflow_runs (
  id uuid primary key default uuid_generate_v7(),
  workflow_id uuid not null references public.ai_workflows (id),
  status ai_workflow_run_status not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer,
  cost numeric(10, 4) not null default 0,
  token_usage integer not null default 0,
  metadata jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create index idx_ai_workflow_runs_workflow_id on public.ai_workflow_runs (workflow_id);
create index idx_ai_workflow_runs_status on public.ai_workflow_runs (status);
create trigger trg_touch_row_no_version before update on public.ai_workflow_runs
  for each row execute function private.touch_row_no_version();

create table public.ai_approvals (
  id uuid primary key default uuid_generate_v7(),
  task_id uuid references public.ai_tasks (id),
  workflow_run_id uuid references public.ai_workflow_runs (id),
  approver uuid not null references public.users (id),
  decision ai_approval_decision not null,
  reason text,
  metadata jsonb not null default '{}',
  approved_at timestamptz not null default now(),
  constraint chk_ai_approvals_target check (task_id is not null or workflow_run_id is not null)
);

create index idx_ai_approvals_task_id on public.ai_approvals (task_id);

create table public.business_memory (
  id uuid primary key default uuid_generate_v7(),
  memory_type text not null,
  title text not null,
  content text not null,
  importance integer not null default 50 check (importance between 0 and 100),
  confidence numeric(3, 2) not null default 0.5 check (confidence between 0 and 1),
  source text,
  approved boolean not null default false,
  expires_at timestamptz,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_business_memory_memory_type on public.business_memory (memory_type);
create trigger trg_touch_row before update on public.business_memory
  for each row execute function private.touch_row();

-- embeddings — §102. Dimension 1536 matches common v1 embedding models
-- (e.g. OpenAI text-embedding-3-small); revisit if the chosen model differs.
create table public.embeddings (
  id uuid primary key default uuid_generate_v7(),
  entity_type text not null,
  entity_id uuid not null,
  embedding_model text not null,
  embedding vector(1536) not null,
  chunk_text text not null,
  chunk_hash text not null,
  language text not null default 'en',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_embeddings_entity on public.embeddings (entity_type, entity_id);
create index idx_embeddings_hnsw on public.embeddings using hnsw (embedding vector_cosine_ops);

create table public.knowledge_graph_nodes (
  id uuid primary key default uuid_generate_v7(),
  node_type text not null,
  label text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_kg_nodes_node_type on public.knowledge_graph_nodes (node_type);
create index idx_kg_nodes_entity_id on public.knowledge_graph_nodes (entity_id);

create table public.knowledge_graph_edges (
  id uuid primary key default uuid_generate_v7(),
  from_node uuid not null references public.knowledge_graph_nodes (id) on delete cascade,
  to_node uuid not null references public.knowledge_graph_nodes (id) on delete cascade,
  relationship text not null,
  confidence numeric(3, 2) not null default 1.0 check (confidence between 0 and 1),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_kg_edges_from_node on public.knowledge_graph_edges (from_node);
create index idx_kg_edges_to_node on public.knowledge_graph_edges (to_node);

create table public.context_cache (
  id uuid primary key default uuid_generate_v7(),
  task_hash text not null unique,
  context jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_context_cache_expires_at on public.context_cache (expires_at);

create table public.ai_cost_tracking (
  id uuid primary key default uuid_generate_v7(),
  agent_id uuid references public.ai_agents (id),
  task_id uuid references public.ai_tasks (id),
  workflow_run_id uuid references public.ai_workflow_runs (id),
  model text not null,
  provider text not null,
  tokens integer not null default 0,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  input_cost numeric(12, 6) not null default 0,
  output_cost numeric(12, 6) not null default 0,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index idx_ai_cost_tracking_created_at on public.ai_cost_tracking (created_at desc);
create index idx_ai_cost_tracking_agent_id on public.ai_cost_tracking (agent_id);

create table public.ai_feedback (
  id uuid primary key default uuid_generate_v7(),
  task_id uuid not null references public.ai_tasks (id),
  rating integer check (rating between 1 and 5),
  accepted boolean not null default false,
  edited boolean not null default false,
  rejected boolean not null default false,
  comments text,
  reviewed_by uuid references public.users (id),
  reviewed_at timestamptz not null default now()
);

create index idx_ai_feedback_task_id on public.ai_feedback (task_id);

-- ai_audit_log — §108. Append-only; nothing is ever deleted.
create table public.ai_audit_log (
  id uuid primary key default uuid_generate_v7(),
  agent_id uuid references public.ai_agents (id),
  task_id uuid references public.ai_tasks (id),
  prompt_version_id uuid references public.ai_prompt_versions (id),
  memory_ids uuid[] not null default '{}',
  tool_ids uuid[] not null default '{}',
  approval_id uuid references public.ai_approvals (id),
  execution_time_ms integer,
  cost numeric(12, 6) not null default 0,
  result jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_ai_audit_log_agent_id on public.ai_audit_log (agent_id);
create index idx_ai_audit_log_created_at on public.ai_audit_log (created_at desc);
