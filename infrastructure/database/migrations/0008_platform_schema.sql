-- Event Store, Observability & Platform Infrastructure — Ch.10 Part 6 (§114-143).

-- event_store — §117. Immutable, append-only backbone of the whole platform.
create table public.event_store (
  id uuid primary key default uuid_generate_v7(),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_version integer not null default 1,
  payload jsonb not null default '{}',
  metadata jsonb not null default '{}',
  correlation_id uuid,
  causation_id uuid,
  created_at timestamptz not null default now()
);

create index idx_event_store_aggregate_id on public.event_store (aggregate_id);
create index idx_event_store_event_type on public.event_store (event_type);
create index idx_event_store_created_at on public.event_store (created_at desc);
create index idx_event_store_correlation_id on public.event_store (correlation_id);
create index idx_event_store_payload_gin on public.event_store using gin (payload);

-- outbox_events — §120/§121. Same transaction as the business write it
-- accompanies; a background worker publishes and updates status.
create table public.outbox_events (
  id uuid primary key default uuid_generate_v7(),
  event_store_id uuid not null references public.event_store (id),
  status outbox_status not null default 'pending',
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  last_error text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_outbox_events_status on public.outbox_events (status);
create index idx_outbox_events_next_retry_at on public.outbox_events (next_retry_at);

-- notifications — §124/§125.
create table public.notifications (
  id uuid primary key default uuid_generate_v7(),
  event_id uuid references public.event_store (id),
  channel notification_channel not null,
  recipient text not null,
  status notification_status not null default 'pending',
  provider text,
  payload jsonb not null default '{}',
  retry_count integer not null default 0,
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_status on public.notifications (status);
create index idx_notifications_channel on public.notifications (channel);

-- jobs — §126/§127.
create table public.jobs (
  id uuid primary key default uuid_generate_v7(),
  job_type text not null,
  status job_status not null default 'queued',
  priority job_priority not null default 'medium',
  payload jsonb not null default '{}',
  attempts integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  next_retry timestamptz,
  worker text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_jobs_status on public.jobs (status);
create index idx_jobs_priority on public.jobs (priority);
create index idx_jobs_next_retry on public.jobs (next_retry);
create trigger trg_touch_row_no_version before update on public.jobs
  for each row execute function private.touch_row_no_version();

-- scheduler_jobs — §128.
create table public.scheduler_jobs (
  id uuid primary key default uuid_generate_v7(),
  name text not null unique,
  cron_expression text not null,
  enabled boolean not null default true,
  last_run timestamptz,
  next_run timestamptz,
  handler text not null,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_touch_row_no_version before update on public.scheduler_jobs
  for each row execute function private.touch_row_no_version();

-- webhook_events — §129/§130. Payload stored exactly as received.
create table public.webhook_events (
  id uuid primary key default uuid_generate_v7(),
  provider text not null,
  event_name text not null,
  signature_verified boolean not null default false,
  payload jsonb not null,
  status webhook_status not null default 'received',
  retry_count integer not null default 0,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index idx_webhook_events_provider on public.webhook_events (provider);
create index idx_webhook_events_status on public.webhook_events (status);

-- analytics_events — §131/§132. Stored separately from operational events.
create table public.analytics_events (
  id uuid primary key default uuid_generate_v7(),
  event_name text not null,
  user_id uuid references public.users (id),
  session_id text,
  page text,
  referrer text,
  device text,
  country text,
  campaign text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_analytics_events_event_name on public.analytics_events (event_name);
create index idx_analytics_events_created_at on public.analytics_events (created_at desc);
create index idx_analytics_events_user_id on public.analytics_events (user_id);

-- health_checks — §136.
create table public.health_checks (
  id uuid primary key default uuid_generate_v7(),
  subsystem text not null,
  status health_status not null,
  message text,
  metadata jsonb not null default '{}',
  checked_at timestamptz not null default now()
);

create index idx_health_checks_subsystem on public.health_checks (subsystem, checked_at desc);

-- system_alerts — §137.
create table public.system_alerts (
  id uuid primary key default uuid_generate_v7(),
  alert_type text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  message text not null,
  acknowledged boolean not null default false,
  acknowledged_by uuid references public.users (id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_system_alerts_acknowledged on public.system_alerts (acknowledged);

-- backup_metadata — §138. Actual backup files live outside Postgres.
create table public.backup_metadata (
  id uuid primary key default uuid_generate_v7(),
  backup_type text not null,
  status text not null,
  storage_location text,
  checksum text,
  restore_tested boolean not null default false,
  encryption_version text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

-- cache_registry — §139. Allows cache debugging; not the cache itself
-- (Redis is), just a record of what's cached and why it was invalidated.
create table public.cache_registry (
  id uuid primary key default uuid_generate_v7(),
  cache_key text not null unique,
  entity text,
  ttl_seconds integer not null,
  invalidation_source text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index idx_cache_registry_expires_at on public.cache_registry (expires_at);
