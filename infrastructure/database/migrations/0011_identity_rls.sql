-- RLS — Identity Domain. Every table: RLS enabled + forced (applies even to
-- the table owner), then explicit policies. No policy = no access for that
-- role, by Postgres default — this file is deliberately exhaustive rather
-- than relying on that default silently.

-- users: self-service profile access; admin sees everyone.
alter table public.users enable row level security;
alter table public.users force row level security;

create policy users_select_own on public.users
  for select to authenticated
  using (id = auth.uid());

create policy users_update_own on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy users_admin_all on public.users
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- roles / permissions / role_permissions: admin-only. RLS helper functions
-- (private.*) run as SECURITY DEFINER owned by the migration role and so
-- bypass RLS for their own internal lookups — this doesn't lock out the
-- permission-check machinery, only direct client access to the tables.
alter table public.roles enable row level security;
alter table public.roles force row level security;
create policy roles_admin_all on public.roles
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

alter table public.permissions enable row level security;
alter table public.permissions force row level security;
create policy permissions_admin_all on public.permissions
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

alter table public.role_permissions enable row level security;
alter table public.role_permissions force row level security;
create policy role_permissions_admin_all on public.role_permissions
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- user_roles: users may see their own role assignments (read-only); only
-- admins assign/revoke roles.
alter table public.user_roles enable row level security;
alter table public.user_roles force row level security;

create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (user_id = auth.uid());

create policy user_roles_admin_all on public.user_roles
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- sessions: users manage their own sessions (view/revoke); admin sees all.
alter table public.sessions enable row level security;
alter table public.sessions force row level security;

create policy sessions_select_own on public.sessions
  for select to authenticated
  using (user_id = auth.uid());

create policy sessions_delete_own on public.sessions
  for delete to authenticated
  using (user_id = auth.uid());

create policy sessions_admin_all on public.sessions
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- oauth_accounts: users can view their own linked accounts. Linking/
-- unlinking is a Supabase Auth server-side flow (service_role), not a
-- direct client write, so there's no client insert/update/delete policy.
alter table public.oauth_accounts enable row level security;
alter table public.oauth_accounts force row level security;

create policy oauth_accounts_select_own on public.oauth_accounts
  for select to authenticated
  using (user_id = auth.uid());

create policy oauth_accounts_admin_all on public.oauth_accounts
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- api_keys: admin/owner only — these are machine-to-machine credentials.
alter table public.api_keys enable row level security;
alter table public.api_keys force row level security;
create policy api_keys_admin_all on public.api_keys
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- service_accounts: admin/owner only.
alter table public.service_accounts enable row level security;
alter table public.service_accounts force row level security;
create policy service_accounts_admin_all on public.service_accounts
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- login_history: users can see their own login history; admin sees all.
-- No client writes — the auth layer/backend appends these.
alter table public.login_history enable row level security;
alter table public.login_history force row level security;

create policy login_history_select_own on public.login_history
  for select to authenticated
  using (user_id = auth.uid());

create policy login_history_admin_all on public.login_history
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- security_events: admin/owner only — operational security monitoring data,
-- not exposed to the user it's about (Ch.15 audit chapter treats this as an
-- internal signal, not a customer-facing record).
alter table public.security_events enable row level security;
alter table public.security_events force row level security;
create policy security_events_admin_all on public.security_events
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());
