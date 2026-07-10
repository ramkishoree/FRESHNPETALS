-- TEST-ONLY SHIM. Not part of the real migration set.
-- Reproduces the subset of Supabase's platform (auth schema, roles, JWT
-- helper functions) that our migrations assume, so they can be applied and
-- verified against a plain Postgres container. Real Supabase projects
-- already provide all of this — never run this file against production.

create extension if not exists pgcrypto;
create extension if not exists vector;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  phone text unique,
  email_confirmed_at timestamptz,
  phone_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$;

create or replace function auth.jwt() returns jsonb
language sql stable
as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
