-- Ch.11 §14: background workers process the `jobs` queue (Ch.10 §127).
-- Atomically claiming one queued job so two concurrent workers never grab
-- the same row requires `FOR UPDATE SKIP LOCKED`, which PostgREST has no
-- filter-based way to express — every supabase-js call is one PostgREST
-- request, and there's no way to ask it for row locking semantics. This is
-- exactly the case documented in packages/core/src/repository.ts: an
-- operation that must be atomic goes through a single Postgres function
-- call, not sequential client calls.
create or replace function public.claim_next_job(p_job_type text, p_worker text)
returns public.jobs
language plpgsql
as $$
declare
  claimed public.jobs;
begin
  select * into claimed
  from public.jobs
  where job_type = p_job_type
    and status = 'queued'
    and (next_retry is null or next_retry <= now())
  order by
    case priority
      when 'critical' then 0
      when 'high' then 1
      when 'medium' then 2
      else 3
    end,
    created_at
  for update skip locked
  limit 1;

  if claimed.id is not null then
    update public.jobs
    set status = 'running', started_at = now(), attempts = attempts + 1, worker = p_worker
    where id = claimed.id
    returning * into claimed;
  end if;

  return claimed;
end;
$$;

comment on function public.claim_next_job(text, text) is
  'Atomically claims the next queued job of a given type (FOR UPDATE SKIP LOCKED). Internal use only — service_role.';

-- Internal-only: not something a customer or admin dashboard user calls
-- directly, only the backend's own worker process (service_role).
revoke all on function public.claim_next_job(text, text) from public, anon, authenticated;
grant execute on function public.claim_next_job(text, text) to service_role;
