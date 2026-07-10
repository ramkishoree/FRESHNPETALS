-- Base grants + RLS helper functions.
--
-- Postgres denies access at the table-privilege level before RLS policies
-- are ever evaluated. Supabase's hosted platform grants anon/authenticated/
-- service_role broad table privileges on `public` by default and relies on
-- RLS to do the real restricting — but that default is platform behavior,
-- not something declared anywhere in this repo. Declaring it explicitly
-- here means these migrations are correct and self-contained on any
-- Postgres (self-hosted Supabase included), not dependent on undocumented
-- platform defaults.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

-- RLS helper functions. Live in `private` (not exposed via PostgREST) so
-- policies can call them without adding attack surface. Handbook Ch.10 §33/
-- §80: "Administrator → Full Access", "Owner → Everything" — the handbook
-- never distinguishes the two for data-access purposes (both get
-- everything), so private.is_admin() treats them identically for RLS.
-- Phase 5+ business logic may still gate Owner-only *features* (e.g.
-- settings) — that's an application-layer distinction, not a DB one.

create or replace function private.has_role(role_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = role_name
      and (ur.expires_at is null or ur.expires_at > now())
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name in ('administrator', 'owner')
      and (ur.expires_at is null or ur.expires_at > now())
  );
$$;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.has_role('owner');
$$;

create or replace function private.has_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and p.name = permission_name
      and (ur.expires_at is null or ur.expires_at > now())
  );
$$;

-- The customer row owned by the currently authenticated user, if any.
create or replace function private.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.customers where user_id = auth.uid();
$$;

comment on function private.is_admin() is
  'True for administrator OR owner — Ch.10 §33/§80 grants both full access, with no data-level distinction.';
