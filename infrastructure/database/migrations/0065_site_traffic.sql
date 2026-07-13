-- Admin traffic dashboard (owner's explicit ask, memory-recorded override
-- of the general "no analytics in admin panel" rule for this project).
-- First-party, aggregate-only counters — no per-visitor rows, no cookies
-- read here, nothing that grows unbounded: one row per day site-wide,
-- one row per day+path. Keeps this table's size trivial forever relative
-- to Supabase's free-tier 500MB ceiling.
create table if not exists public.site_traffic_daily (
  date date primary key,
  page_views integer not null default 0
);

create table if not exists public.site_traffic_page_daily (
  date date not null,
  path text not null,
  views integer not null default 0,
  primary key (date, path)
);

-- RLS on, deliberately zero policies: this data is only ever written by
-- track_page_view() below (security definer, service_role-only execute)
-- and only ever read by the admin dashboard via the service-role client
-- — no anon/authenticated session should ever see or touch these rows
-- directly, so default-deny is the correct (not incomplete) policy set.
alter table public.site_traffic_daily enable row level security;
alter table public.site_traffic_page_daily enable row level security;

create or replace function public.track_page_view(p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.site_traffic_daily (date, page_views)
  values (current_date, 1)
  on conflict (date) do update set page_views = site_traffic_daily.page_views + 1;

  insert into public.site_traffic_page_daily (date, path, views)
  values (current_date, p_path, 1)
  on conflict (date, path) do update set views = site_traffic_page_daily.views + 1;
end;
$$;

comment on function public.track_page_view is
  'Increments today''s site-wide and per-path page-view counters. Called only from the public /api/v1/track route via the service-role client — never exposed directly to anon.';

revoke all on function public.track_page_view from public, anon, authenticated;
grant execute on function public.track_page_view to service_role;
