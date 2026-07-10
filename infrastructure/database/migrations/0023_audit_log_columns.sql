-- Ch.16 §111 (Administrator Audit Log API) and Ch.8 §117 (Audit Domain)
-- both describe a platform-wide, immutable, append-only audit log —
-- "every critical business action" (product/inventory/coupon/order/
-- payment/security), filterable by Date Range/User/Action/Severity/
-- Service, storing Actor/Action/Entity/Previous Value/New Value/IP
-- Address/User Agent/Correlation ID. No dedicated table exists anywhere
-- in Ch.10's schema — but `event_store` (Ch.10 §117) is already described
-- as "the immutable, append-only backbone of the whole platform" and
-- already has event_type (Action), aggregate_type/aggregate_id
-- (Entity Type/ID), payload (Previous/New Value), correlation_id. Adding
-- the missing columns here keeps ONE audit backbone instead of forking a
-- parallel `admin_audit_log` table that would fragment it.
--
-- `severity`/`service` appear only in the API section's filter list, not
-- the record shape in Ch.8 §117 — added anyway since the API can't filter
-- by a dimension the record doesn't carry, and adding columns is strictly
-- additive to an existing, already-immutable table.

alter table public.event_store
  add column actor_id uuid references public.users (id),
  add column actor_ip inet,
  add column user_agent text,
  add column severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  add column service text;

create index idx_event_store_actor_id on public.event_store (actor_id);
create index idx_event_store_severity on public.event_store (severity);
create index idx_event_store_service on public.event_store (service);

comment on column public.event_store.actor_id is 'Ch.8 §117 Audit Record "Actor" — null for system-generated events.';
comment on column public.event_store.actor_ip is 'Ch.8 §117 Audit Record "IP Address".';
comment on column public.event_store.user_agent is 'Ch.8 §117 Audit Record "User Agent".';
comment on column public.event_store.severity is 'Ch.16 §111 Audit Log API filter dimension.';
comment on column public.event_store.service is 'Ch.16 §111 Audit Log API filter dimension — e.g. products, inventory, orders, security.';
