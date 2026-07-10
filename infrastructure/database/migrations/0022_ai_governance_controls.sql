-- Ch.14 §80 (AI Kill Switch) and §81 (Budget Enforcement) — first-class
-- controls the handbook requires ("Disable Entire AI / Individual Agent /
-- Provider / Tool / Workflow", "Daily/Weekly/Monthly, Per Provider/Agent/
-- Workflow" budgets with 50/75/90/100% thresholds), but Ch.10's AI schema
-- never defines a table for either. Filled here, same rationale as 0021.

create table public.ai_kill_switches (
  id uuid primary key default uuid_generate_v7(),
  scope text not null check (scope in ('global', 'agent', 'provider', 'tool', 'workflow')),
  -- Null for scope = 'global'; otherwise the agent slug / provider name /
  -- tool name / workflow name being disabled.
  scope_ref text,
  disabled boolean not null default false,
  reason text,
  disabled_by uuid references public.users (id),
  disabled_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, scope_ref)
);

create trigger trg_touch_row before update on public.ai_kill_switches
  for each row execute function private.touch_row();

alter table public.ai_kill_switches enable row level security;
alter table public.ai_kill_switches force row level security;
create policy ai_kill_switches_admin_all on public.ai_kill_switches
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create table public.ai_budgets (
  id uuid primary key default uuid_generate_v7(),
  scope text not null check (scope in ('global', 'provider', 'agent', 'workflow')),
  scope_ref text,
  period text not null check (period in ('daily', 'weekly', 'monthly')),
  limit_amount numeric(12, 2) not null check (limit_amount >= 0),
  currency char(3) not null default 'USD',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, scope_ref, period)
);

create trigger trg_touch_row before update on public.ai_budgets
  for each row execute function private.touch_row();

alter table public.ai_budgets enable row level security;
alter table public.ai_budgets force row level security;
create policy ai_budgets_admin_all on public.ai_budgets
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());
