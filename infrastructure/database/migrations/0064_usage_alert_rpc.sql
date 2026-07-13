-- Free-tier usage alerting (owner's ask: an email in advance of nearing
-- Supabase's free-tier ceilings, since the site runs on free Vercel +
-- Supabase tiers until traffic justifies paying). This RPC is the read
-- side only — the daily cron sweep (server/ops/usage-threshold-sweep.ts)
-- calls it, compares against thresholds, and emails if any are close.
--
-- security definer: storage.objects and auth.users aren't granted to
-- service_role by default (Storage/Auth are separate services that own
-- those schemas) — running as the migration's own (postgres) owner
-- sidesteps that rather than granting service_role broad cross-schema
-- access it doesn't otherwise need.
create or replace function public.admin_get_usage_snapshot()
returns table (
  database_size_bytes bigint,
  media_bucket_bytes bigint,
  invoices_bucket_bytes bigint,
  auth_user_count bigint
)
language plpgsql
security definer
set search_path = public, storage, auth
as $$
begin
  return query
  select
    pg_database_size(current_database()),
    coalesce((select sum((metadata->>'size')::bigint) from storage.objects where bucket_id = 'media'), 0)::bigint,
    coalesce((select sum((metadata->>'size')::bigint) from storage.objects where bucket_id = 'invoices'), 0)::bigint,
    (select count(*) from auth.users)::bigint;
end;
$$;

comment on function public.admin_get_usage_snapshot is
  'Snapshot of free-tier-relevant usage (DB size, storage bucket bytes, auth user count) for the daily usage-threshold alert cron. Service-role only.';

revoke all on function public.admin_get_usage_snapshot from public, anon, authenticated;
grant execute on function public.admin_get_usage_snapshot to service_role;
