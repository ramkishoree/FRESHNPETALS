-- Ch.8 §104: "FNP-2026-000001 — Business Prefix, Year, Incremental
-- Sequence. Never reused." A plain Postgres SEQUENCE doesn't reset per
-- calendar year on its own, so this uses a small counter table with an
-- atomic increment-and-return function instead of DDL-level sequence
-- rotation.
create table public.order_number_counters (
  year integer primary key,
  next_sequence integer not null default 1
);

create or replace function public.generate_order_number(p_prefix text default 'FNP')
returns text
language plpgsql
as $$
declare
  v_year integer := extract(year from now())::integer;
  v_seq integer;
begin
  insert into public.order_number_counters (year, next_sequence)
  values (v_year, 2)
  on conflict (year) do update set next_sequence = order_number_counters.next_sequence + 1
  returning next_sequence - 1 into v_seq;

  return p_prefix || '-' || v_year || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

comment on function public.generate_order_number is
  'Atomically issues the next FNP-<year>-NNNNNN order number (Ch.8 §104). Admin/checkout RPCs only.';

revoke all on function public.generate_order_number from public, anon, authenticated;
grant execute on function public.generate_order_number to service_role;

alter table public.order_number_counters enable row level security;
alter table public.order_number_counters force row level security;
create policy order_number_counters_admin_select on public.order_number_counters
  for select to authenticated using (private.is_admin());
