-- Ch.14 §68: Model Registry — "Every model is registered... Only approved
-- models may be used in production." Ch.10's AI schema (Part 5) never
-- defines this table — ai_agents only has free-text preferred_model/
-- fallback_model columns, no governance gate behind them. Gap filled here,
-- same as coupons/offers/reviews/product_prices in Phase 3.

create type ai_model_approval_status as enum ('pending', 'approved', 'deprecated', 'rejected');

create table public.ai_models (
  id uuid primary key default uuid_generate_v7(),
  provider text not null,
  model_name text not null,
  model_version text,
  context_window integer,
  supports_structured_output boolean not null default false,
  supports_tool_calling boolean not null default false,
  supports_vision boolean not null default false,
  supports_embeddings boolean not null default false,
  input_cost_per_1k numeric(10, 6) not null default 0,
  output_cost_per_1k numeric(10, 6) not null default 0,
  avg_latency_ms integer,
  approval_status ai_model_approval_status not null default 'pending',
  health health_status not null default 'healthy',
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, model_name, model_version)
);

create index idx_ai_models_provider on public.ai_models (provider);
create index idx_ai_models_approval_status on public.ai_models (approval_status);

create trigger trg_touch_row before update on public.ai_models
  for each row execute function private.touch_row();

-- Internal governance data — admin/owner only, never customer/anon facing.
alter table public.ai_models enable row level security;
alter table public.ai_models force row level security;
create policy ai_models_admin_all on public.ai_models
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());
