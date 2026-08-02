-- Closes the Supabase database-linter findings that were open after 0066.
-- None of these were introduced by the revamp; they had accumulated since
-- 0001 and the linter surfaces them against the live project.

-- ---------------------------------------------------------------------
-- 1. ERROR: rls_disabled_in_public — public._schema_migrations
-- ---------------------------------------------------------------------
-- The migration ledger created by scripts/migrate.mjs is in `public`, so
-- PostgREST exposes it and anon could read the full migration filename
-- history. It has no business being reachable over the REST API at all.
--
-- migrate.mjs connects with `pg` over DATABASE_URL as the postgres role,
-- which bypasses both RLS and these grants — the ledger keeps working.
-- No policy is created on purpose: RLS with zero policies denies every
-- non-superuser, which is exactly the intent.
alter table public._schema_migrations enable row level security;
revoke all on public._schema_migrations from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. WARN: function_search_path_mutable — 16 functions
-- ---------------------------------------------------------------------
-- A function without a pinned search_path resolves unqualified names
-- against the caller's search_path, so a caller who can create objects in
-- an earlier schema can shadow the ones the body meant to reach. All 16
-- are SECURITY INVOKER (so the blast radius is the caller's own rights,
-- not the owner's), but pinning is still the correct hygiene.
--
-- `public, pg_temp` rather than `''`: these bodies reference app tables
-- unqualified, and rewriting all 16 to fully-qualify every reference is a
-- far larger and riskier change than pinning the resolution order.
-- pg_temp goes last so a caller's temp objects cannot shadow public ones.
--
-- Driven off the catalogue rather than a hand-written list of signatures:
-- `proconfig is null` means the ones already pinned (private.is_admin,
-- handle_new_auth_user, …) are skipped, and the extension-owned pgvector
-- and pg_trgm functions are excluded by name so this never tries to alter
-- objects the migration role does not own.
do $$
declare
  fn record;
begin
  for fn in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prokind = 'f'
      and p.proconfig is null
      and (
        n.nspname = 'private'
        or (
          n.nspname = 'public'
          and p.proname in (
            'uuid_generate_v7',
            'generate_order_number',
            'claim_next_job',
            'checkout_start',
            'checkout_complete',
            'checkout_cancel',
            'checkout_expire_stale_sessions',
            'admin_create_product',
            'admin_update_product_price',
            'admin_adjust_inventory',
            'admin_set_inventory_stock',
            'admin_update_order_status',
            'admin_set_user_roles',
            'ai_approval_decide'
          )
        )
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp',
      fn.schema_name, fn.function_name, fn.args
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. WARN: anon/authenticated can execute a SECURITY DEFINER function
-- ---------------------------------------------------------------------
-- handle_new_auth_user() is the auth.users insert trigger that provisions
-- the matching customers row. It is SECURITY DEFINER, and PostgREST was
-- also exposing it at /rest/v1/rpc/handle_new_auth_user for anyone —
-- signed in or not — to call directly, outside the trigger context it
-- assumes.
--
-- Safe to revoke: Postgres checks EXECUTE on a trigger function when the
-- trigger is CREATEd, not each time it fires, so signup keeps working.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Deliberately NOT addressed here
-- ---------------------------------------------------------------------
-- WARN extension_in_public (vector, pg_trgm): relocating an extension
-- requires dropping and rebuilding every dependent index and column type.
-- Both are Supabase's own default install location, neither is reachable
-- as data, and the rebuild risk on a live catalogue outweighs the lint.
-- Accepted as-is; revisit only if the extensions are being upgraded.
--
-- WARN auth_leaked_password_protection: an Auth service setting, not
-- schema. Enabled via the Management API, not reachable from SQL.
