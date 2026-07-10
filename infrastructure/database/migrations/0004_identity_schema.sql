-- Identity Domain — Handbook Ch.10 Part 4.
-- Supabase Auth (auth.users) owns authentication (password hashing, email
-- verification, password reset) per §79 — "password hashes never exist
-- inside application tables". public.users is a 1:1 profile row keyed on
-- the same id, which is what every other domain's created_by/updated_by/
-- actor FK points to.

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  phone text unique,
  full_name text,
  avatar_url text,
  auth_provider auth_provider not null default 'email',
  email_verified boolean not null default false,
  phone_verified boolean not null default false,
  status user_status not null default 'active',
  last_login_at timestamptz,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_users_email on public.users (email);
create index idx_users_phone on public.users (phone);
create index idx_users_status on public.users (status);
create index idx_users_last_login_at on public.users (last_login_at);

create trigger trg_touch_row before update on public.users
  for each row execute function private.touch_row();

-- Auto-provision a public.users profile whenever Supabase Auth creates a user.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, phone, auth_provider, email_verified)
  values (
    new.id,
    new.email,
    new.phone,
    'email',
    new.email_confirmed_at is not null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Roles — §65/§66. Version 1: anonymous, customer, administrator, owner.
create table public.roles (
  id uuid primary key default uuid_generate_v7(),
  name text not null unique,
  description text,
  priority integer not null default 0,
  system_role boolean not null default false,
  created_at timestamptz not null default now()
);

-- Permissions — §67. One row per granular action string, never "admin=true".
create table public.permissions (
  id uuid primary key default uuid_generate_v7(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

-- role_permissions — §68, many-to-many.
create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

-- user_roles — §69/§70. One user, many roles; expiry/delegation are Future.
create table public.user_roles (
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  assigned_by uuid references public.users (id),
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (user_id, role_id)
);

create index idx_user_roles_role_id on public.user_roles (role_id);

-- sessions — §71, folding "Device Sessions" (§72) into the same table since
-- the handbook never gives §72 its own column list; every column §72 asks
-- for (browser/OS/device/last activity/login time) already lives here.
create table public.sessions (
  id uuid primary key default uuid_generate_v7(),
  user_id uuid not null references public.users (id) on delete cascade,
  device_id text,
  device_name text,
  os text,
  browser text,
  refresh_token_hash text not null,
  ip_address_hash text,
  user_agent text,
  last_activity timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_sessions_user_id on public.sessions (user_id);
create index idx_sessions_expires_at on public.sessions (expires_at);

-- oauth_accounts — §73. Version 1: Google only.
create table public.oauth_accounts (
  id uuid primary key default uuid_generate_v7(),
  user_id uuid not null references public.users (id) on delete cascade,
  provider oauth_provider not null,
  provider_user_id text not null,
  provider_email text,
  linked_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  unique (provider, provider_user_id)
);

create index idx_oauth_accounts_user_id on public.oauth_accounts (user_id);

-- api_keys — §74. Machine-to-machine auth; key_hash only, never plaintext.
create table public.api_keys (
  id uuid primary key default uuid_generate_v7(),
  name text not null,
  key_hash text not null unique,
  permissions text[] not null default '{}',
  status api_key_status not null default 'active',
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

-- service_accounts — §75. Used by background jobs/AI agents/automation;
-- cannot log into the UI. No column list given in the handbook; kept
-- minimal (name/type/status) since only an identity to attribute actions to
-- is required at the database layer today.
create table public.service_accounts (
  id uuid primary key default uuid_generate_v7(),
  name text not null unique,
  description text,
  account_type text not null check (account_type in ('background_job', 'ai_agent', 'automation', 'integration')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now()
);

-- login_history — §76. Append-only.
create table public.login_history (
  id uuid primary key default uuid_generate_v7(),
  user_id uuid references public.users (id) on delete set null,
  ip_address_hash text,
  country text,
  city text,
  browser text,
  os text,
  device text,
  success boolean not null,
  failure_reason text,
  risk_score numeric(5, 2),
  occurred_at timestamptz not null default now()
);

create index idx_login_history_user_id on public.login_history (user_id);
create index idx_login_history_occurred_at on public.login_history (occurred_at desc);

-- security_events — §77. Append-only.
create table public.security_events (
  id uuid primary key default uuid_generate_v7(),
  user_id uuid references public.users (id) on delete set null,
  event_type text not null,
  description text,
  ip_address_hash text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_security_events_user_id on public.security_events (user_id);
create index idx_security_events_event_type on public.security_events (event_type);
create index idx_security_events_created_at on public.security_events (created_at desc);
