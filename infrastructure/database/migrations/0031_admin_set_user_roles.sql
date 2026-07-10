-- Ch.16 §110 User & Role Management API. Replacing a user's role set is a
-- delete-then-insert on `user_roles` — two PostgREST calls would leave a
-- user with zero roles for the moment between them if the second call
-- failed; one function call keeps it atomic (same rationale as 0025).

create or replace function public.admin_set_user_roles(
  p_user_id uuid,
  p_role_names text[],
  p_actor_id uuid
)
returns void
language plpgsql
as $$
begin
  delete from public.user_roles where user_id = p_user_id;

  insert into public.user_roles (user_id, role_id, assigned_by)
  select p_user_id, r.id, p_actor_id
  from public.roles r
  where r.name = any(p_role_names);
end;
$$;

comment on function public.admin_set_user_roles is
  'Atomically replaces a user''s full role set (Ch.16 §110). Admin API only.';

revoke all on function public.admin_set_user_roles from public, anon, authenticated;
grant execute on function public.admin_set_user_roles to service_role;
