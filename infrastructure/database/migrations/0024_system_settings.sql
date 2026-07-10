-- Ch.16 §112 (System Configuration API): GET/PATCH /api/v1/admin/settings
-- across Business/Payment/Delivery/Tax/SEO Defaults/Email/AI/Feature Flags
-- — "Critical settings require Owner role." No settings table exists
-- anywhere in Ch.10's 7-part schema despite this API section demanding
-- one; filled here, same rationale as every other Ch.10 gap this project
-- has filled (0009's coupons/offers/reviews, 0021/0022's AI governance).
--
-- Key-value rather than one column per setting: Ch.16 §112's own list of
-- setting categories is explicitly open-ended ("Feature Flags" is a
-- category, not a fixed set), and Ch.6's IA principles (§998) require the
-- architecture to stay "Multi Business Ready" — a rigid settings schema
-- tied to flower-shop-specific fields would violate that on the first
-- non-Fresh & Petals tenant.

create table public.system_settings (
  id uuid primary key default uuid_generate_v7(),
  key text not null unique,
  category text not null check (
    category in ('business', 'payment', 'delivery', 'tax', 'seo', 'email', 'ai', 'feature_flags')
  ),
  value jsonb not null default '{}',
  description text,
  -- Ch.16 §112: "Critical settings require Owner role" — a per-setting
  -- flag, not a per-category one, since e.g. payment settings mix routine
  -- toggles with the Razorpay key rotation that must stay Owner-gated.
  requires_owner boolean not null default false,
  updated_by uuid references public.users (id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_system_settings_category on public.system_settings (category);

create trigger trg_touch_row before update on public.system_settings
  for each row execute function private.touch_row();

alter table public.system_settings enable row level security;
alter table public.system_settings force row level security;

-- Any administrator/owner can read every setting (Ch.16 §112 gates
-- *editing* critical settings to Owner, not visibility).
create policy system_settings_select_admin on public.system_settings
  for select to authenticated
  using (private.is_admin());

create policy system_settings_insert_admin on public.system_settings
  for insert to authenticated
  with check (private.is_admin() and (not requires_owner or private.is_owner()));

create policy system_settings_update_admin on public.system_settings
  for update to authenticated
  using (private.is_admin() and (not requires_owner or private.is_owner()))
  with check (private.is_admin() and (not requires_owner or private.is_owner()));

create policy system_settings_delete_owner on public.system_settings
  for delete to authenticated
  using (private.is_owner());
