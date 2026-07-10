-- Ch.10 §16's universal-column rule applies to every table except the
-- deliberately-exempted immutable financial records (orders/payments/
-- invoices — see 0006's file header). delivery_groups and delivery_slots
-- are operational configuration, same category as `outlets` (which has
-- the full set) — their omission looks like a gap in 0006, not a second
-- deliberate exemption. Ch.16 §106 (Delivery Slot Management API) expects
-- a working DELETE, which needs `deleted_at` to soft-delete against.

alter table public.delivery_groups
  add column created_by uuid references public.users (id),
  add column updated_by uuid references public.users (id),
  add column deleted_at timestamptz;

alter table public.delivery_slots
  add column created_by uuid references public.users (id),
  add column updated_by uuid references public.users (id),
  add column deleted_at timestamptz;
