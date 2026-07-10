-- Ch.16 §98 Customer Management API: "Status, Tags, Internal Notes,
-- Marketing Preferences" — `marketing_opt_in` already covers the last
-- one; the first three have no column anywhere in Ch.10's customer
-- schema (0005), same class of gap as system_settings/audit columns.

alter table public.customers
  add column status text not null default 'active' check (status in ('active', 'flagged', 'blocked')),
  add column tags text[] not null default '{}',
  add column internal_notes text;

create index idx_customers_status on public.customers (status);
