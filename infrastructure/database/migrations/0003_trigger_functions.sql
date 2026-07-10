-- Shared trigger functions applied to every mutable table.
-- Handbook Ch.10 §16 (universal columns), §20 (optimistic versioning),
-- §36 (automatic triggers: update updated_at, increment version).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.touch_row()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

comment on function private.touch_row() is
  'Bumps updated_at and version on every UPDATE. Attach to every table that has both columns (Ch.10 §16/§20).';

-- Variant for the handful of tables that track updated_at but were
-- deliberately not given a version column (e.g. ai_workflow_runs — a
-- system-driven progress log, not something concurrent admins edit).
create or replace function private.touch_row_no_version()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function private.touch_row_no_version() is
  'Bumps updated_at only, for mutable tables without a version column.';
