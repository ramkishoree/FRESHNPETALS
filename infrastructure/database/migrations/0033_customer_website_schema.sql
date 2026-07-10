-- Ch.16 §74 (Recipient API), §79 (Wishlist API), §82 (Recently Viewed
-- API), Ch.12 §32/§33 (Wishlist, Recently Viewed) — three customer-owned
-- resources named throughout Ch.12/Ch.16 but never given a physical
-- schema anywhere in Ch.10, same class of gap as Phase 3's coupons/
-- offers/reviews and Phase 8's system_settings/audit columns.

create table public.wishlists (
  id uuid primary key default uuid_generate_v7(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

create index idx_wishlists_customer_id on public.wishlists (customer_id);

-- recipients — §74. "Recipients available during checkout" reuses the
-- same address shape customer_addresses already has rather than
-- inventing a second one; a recipient without a saved address is valid
-- (delivery details entered fresh at checkout), hence the nullable FK.
create table public.recipients (
  id uuid primary key default uuid_generate_v7(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text,
  default_message text,
  address_id uuid references public.customer_addresses (id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_recipients_customer_id on public.recipients (customer_id);
create trigger trg_touch_row before update on public.recipients
  for each row execute function private.touch_row();

-- recently_viewed — §33/§82. "Logged In: Database" (guests use
-- localStorage client-side, Ch.12 §33 — nothing to persist server-side
-- for them). One row per customer+product, timestamp bumped on repeat
-- views rather than growing unbounded.
create table public.recently_viewed (
  id uuid primary key default uuid_generate_v7(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

create index idx_recently_viewed_customer_id on public.recently_viewed (customer_id, viewed_at desc);

alter table public.wishlists enable row level security;
alter table public.wishlists force row level security;
create policy wishlists_select_own on public.wishlists
  for select to authenticated using (customer_id = private.current_customer_id());
create policy wishlists_insert_own on public.wishlists
  for insert to authenticated with check (customer_id = private.current_customer_id());
create policy wishlists_delete_own on public.wishlists
  for delete to authenticated using (customer_id = private.current_customer_id());
create policy wishlists_admin_all on public.wishlists
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

alter table public.recipients enable row level security;
alter table public.recipients force row level security;
create policy recipients_select_own on public.recipients
  for select to authenticated using (customer_id = private.current_customer_id());
create policy recipients_insert_own on public.recipients
  for insert to authenticated with check (customer_id = private.current_customer_id());
create policy recipients_update_own on public.recipients
  for update to authenticated
  using (customer_id = private.current_customer_id())
  with check (customer_id = private.current_customer_id());
create policy recipients_delete_own on public.recipients
  for delete to authenticated using (customer_id = private.current_customer_id());
create policy recipients_admin_all on public.recipients
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

alter table public.recently_viewed enable row level security;
alter table public.recently_viewed force row level security;
create policy recently_viewed_select_own on public.recently_viewed
  for select to authenticated using (customer_id = private.current_customer_id());
create policy recently_viewed_insert_own on public.recently_viewed
  for insert to authenticated with check (customer_id = private.current_customer_id());
create policy recently_viewed_update_own on public.recently_viewed
  for update to authenticated
  using (customer_id = private.current_customer_id())
  with check (customer_id = private.current_customer_id());
create policy recently_viewed_delete_own on public.recently_viewed
  for delete to authenticated using (customer_id = private.current_customer_id());
create policy recently_viewed_admin_all on public.recently_viewed
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
