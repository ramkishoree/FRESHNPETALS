-- RLS — Event Store, Observability & Platform Infrastructure. Entirely
-- internal/operational: admin-only read (dashboards), no client writes.
-- The event/outbox/job/webhook pipeline is written exclusively by the
-- backend's service_role, which bypasses RLS by grant (BYPASSRLS).

create policy event_store_select_admin on public.event_store
  for select to authenticated using (private.is_admin());
alter table public.event_store enable row level security;
alter table public.event_store force row level security;

create policy outbox_events_select_admin on public.outbox_events
  for select to authenticated using (private.is_admin());
alter table public.outbox_events enable row level security;
alter table public.outbox_events force row level security;

create policy notifications_admin_all on public.notifications
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.notifications enable row level security;
alter table public.notifications force row level security;

create policy jobs_select_admin on public.jobs
  for select to authenticated using (private.is_admin());
alter table public.jobs enable row level security;
alter table public.jobs force row level security;

create policy scheduler_jobs_admin_all on public.scheduler_jobs
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.scheduler_jobs enable row level security;
alter table public.scheduler_jobs force row level security;

create policy webhook_events_select_admin on public.webhook_events
  for select to authenticated using (private.is_admin());
alter table public.webhook_events enable row level security;
alter table public.webhook_events force row level security;

create policy analytics_events_select_admin on public.analytics_events
  for select to authenticated using (private.is_admin());
alter table public.analytics_events enable row level security;
alter table public.analytics_events force row level security;

create policy health_checks_select_admin on public.health_checks
  for select to authenticated using (private.is_admin());
alter table public.health_checks enable row level security;
alter table public.health_checks force row level security;

create policy system_alerts_admin_all on public.system_alerts
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.system_alerts enable row level security;
alter table public.system_alerts force row level security;

create policy backup_metadata_select_admin on public.backup_metadata
  for select to authenticated using (private.is_admin());
alter table public.backup_metadata enable row level security;
alter table public.backup_metadata force row level security;

create policy cache_registry_select_admin on public.cache_registry
  for select to authenticated using (private.is_admin());
alter table public.cache_registry enable row level security;
alter table public.cache_registry force row level security;
