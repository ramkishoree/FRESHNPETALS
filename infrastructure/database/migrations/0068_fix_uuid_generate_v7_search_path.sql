-- Repairs the site-wide write outage that 0067 introduced.
--
-- 0067 closed the `function_search_path_mutable` advisor warning by
-- running `alter function ... set search_path = public, pg_temp` over a
-- list of functions, and `uuid_generate_v7` was on that list. Its body
-- calls `gen_random_bytes(10)`, which pgcrypto provides — and on Supabase
-- pgcrypto is installed in the `extensions` schema, not `public`. The
-- unqualified call had been resolving through the *caller's* search_path
-- all along; pinning the function's own search_path to `public, pg_temp`
-- removed `extensions` from resolution and the call stopped resolving:
--
--   ERROR: 42883: function gen_random_bytes(integer) does not exist
--   CONTEXT: PL/pgSQL function uuid_generate_v7() line 7
--
-- 81 tables default their `id` to `uuid_generate_v7()`, so every insert
-- across the entire schema failed — checkout surfaced it first as a 500
-- from `checkout_start`, but orders, reviews, addresses, jobs and the
-- rest were equally dead.
--
-- The fix keeps the search_path pinned (so the advisor finding stays
-- closed and the function is still immune to a hostile caller's path)
-- and simply admits `extensions` to it. Postgres ignores a schema in
-- search_path that doesn't exist, so this is also correct on a vanilla
-- Postgres where `create extension pgcrypto` puts it in `public`
-- instead — which is what the disposable-Postgres migration test runs.

alter function public.uuid_generate_v7() set search_path = public, extensions, pg_temp;

do $$
declare
  v_id uuid;
begin
  v_id := public.uuid_generate_v7();
  if v_id is null then
    raise exception 'uuid_generate_v7() returned null after the search_path repair';
  end if;
  -- Version nibble must be 7 per RFC 9562; proves the body actually ran
  -- rather than the call silently degrading to something else.
  if substring(v_id::text from 15 for 1) <> '7' then
    raise exception 'uuid_generate_v7() produced a non-v7 uuid: %', v_id;
  end if;
end $$;
