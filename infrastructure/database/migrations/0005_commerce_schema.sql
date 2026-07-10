-- Commerce Domain — Handbook Ch.10 Part 2 (§22-38).
-- Three entities are named throughout the handbook as Commerce aggregate
-- roots (Ch.10 §5/§12, Ch.8, Ch.9, Ch.16) but never given a physical schema
-- anywhere in Ch.10: coupons, offers, reviews. Also, products explicitly has
-- no price column ("Pricing snapshots are NOT stored here", §24) but no
-- separate pricing table is defined either — a gap given inventory got its
-- own dedicated table for the identical reason. All four are designed here,
-- informed by the business rules Ch.8/Ch.9/Ch.16 do give, and flagged in
-- docs/database-schema.md. Every table gets the Ch.10 §16 universal columns
-- even where an individual section's column list didn't restate them.

create table public.categories (
  id uuid primary key default uuid_generate_v7(),
  parent_id uuid references public.categories (id),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_categories_parent_id on public.categories (parent_id);
create index idx_categories_slug on public.categories (slug);
create index idx_categories_sort_order on public.categories (sort_order);
create trigger trg_touch_row before update on public.categories
  for each row execute function private.touch_row();

create table public.collections (
  id uuid primary key default uuid_generate_v7(),
  name text not null,
  slug text not null unique,
  description text,
  hero_image text,
  is_featured boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_collections_slug on public.collections (slug);
create index idx_collections_is_featured on public.collections (is_featured);
create trigger trg_touch_row before update on public.collections
  for each row execute function private.touch_row();

-- products — §24. Inventory and pricing intentionally live in their own
-- tables (inventory below; product_prices below), not as columns here.
create table public.products (
  id uuid primary key default uuid_generate_v7(),
  sku text not null unique,
  slug text not null unique,
  name text not null,
  short_description text,
  description text,
  category_id uuid not null references public.categories (id),
  collection_id uuid references public.collections (id),
  status product_status not null default 'draft',
  visibility boolean not null default true,
  seo_title text,
  meta_description text,
  canonical_url text,
  featured_image text,
  ai_generated boolean not null default false,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint chk_products_slug_lowercase check (slug = lower(slug))
);

create index idx_products_sku on public.products (sku);
create index idx_products_slug on public.products (slug);
create index idx_products_status on public.products (status);
create index idx_products_category_id on public.products (category_id);
create index idx_products_collection_id on public.products (collection_id);
create index idx_products_created_at on public.products (created_at desc);
create index idx_products_metadata_gin on public.products using gin (metadata);
create index idx_products_search_gin on public.products
  using gin (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')));
create trigger trg_touch_row before update on public.products
  for each row execute function private.touch_row();

-- product_prices — not specified in Ch.10 (see file header). Current price
-- lives here, versioned; order_items still snapshot the price at purchase
-- time independently (§44), so this table is never joined to reconstruct
-- a historical invoice.
create table public.product_prices (
  id uuid primary key default uuid_generate_v7(),
  product_id uuid not null unique references public.products (id) on delete cascade,
  base_price numeric(12, 2) not null check (base_price >= 0),
  sale_price numeric(12, 2) check (sale_price is null or (sale_price >= 0 and sale_price <= base_price)),
  currency char(3) not null default 'INR',
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_touch_row before update on public.product_prices
  for each row execute function private.touch_row();

-- product_price_history — append-only audit trail (Ch.9 "Price Versioning").
create table public.product_price_history (
  id uuid primary key default uuid_generate_v7(),
  product_id uuid not null references public.products (id) on delete cascade,
  old_base_price numeric(12, 2),
  new_base_price numeric(12, 2) not null,
  old_sale_price numeric(12, 2),
  new_sale_price numeric(12, 2),
  reason text,
  changed_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

create index idx_product_price_history_product_id on public.product_price_history (product_id);

-- tags / product_tags — §27, many-to-many.
create table public.tags (
  id uuid primary key default uuid_generate_v7(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.product_tags (
  product_id uuid not null references public.products (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (product_id, tag_id)
);

-- outlets — §28.
create table public.outlets (
  id uuid primary key default uuid_generate_v7(),
  name text not null,
  slug text not null unique,
  address text not null,
  city text not null,
  state text,
  country text not null default 'IN',
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  delivery_radius_km numeric(6, 2) not null default 10,
  working_hours jsonb not null default '{}',
  timezone text not null default 'Asia/Kolkata',
  phone text,
  email text,
  is_active boolean not null default true,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_outlets_city on public.outlets (city);
create index idx_outlets_is_active on public.outlets (is_active);
create index idx_outlets_lat_lng on public.outlets (latitude, longitude);
create trigger trg_touch_row before update on public.outlets
  for each row execute function private.touch_row();

-- inventory — §29. Stock is per-outlet, never global (Ch.8 §8.6).
create table public.inventory (
  id uuid primary key default uuid_generate_v7(),
  product_id uuid not null references public.products (id) on delete cascade,
  outlet_id uuid not null references public.outlets (id) on delete cascade,
  physical_quantity integer not null default 0 check (physical_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  available_quantity integer generated always as (physical_quantity - reserved_quantity) stored,
  low_stock_threshold integer not null default 5,
  critical_threshold integer not null default 1,
  reorder_quantity integer not null default 20,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id),
  unique (outlet_id, product_id),
  constraint chk_inventory_available_non_negative check (available_quantity >= 0)
);

create index idx_inventory_product_id on public.inventory (product_id);
create index idx_inventory_outlet_id on public.inventory (outlet_id);
create index idx_inventory_available_quantity on public.inventory (available_quantity);
create index idx_inventory_updated_at on public.inventory (updated_at);
create trigger trg_touch_row before update on public.inventory
  for each row execute function private.touch_row();

-- inventory_transactions — §30. Append-only; every movement is a new row.
create table public.inventory_transactions (
  id uuid primary key default uuid_generate_v7(),
  inventory_id uuid not null references public.inventory (id),
  transaction_type inventory_transaction_type not null,
  quantity integer not null,
  previous_quantity integer not null,
  new_quantity integer not null,
  reason text,
  order_id uuid,
  administrator_id uuid references public.users (id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_inventory_transactions_inventory_id on public.inventory_transactions (inventory_id);
create index idx_inventory_transactions_order_id on public.inventory_transactions (order_id);
create index idx_inventory_transactions_created_at on public.inventory_transactions (created_at desc);

-- customers — §31. user_id is nullable: guest checkout is mandatory (Ch.8
-- "never force registration"), so a customer row can exist before — or
-- without ever having — an auth account. Registering later links user_id.
create table public.customers (
  id uuid primary key default uuid_generate_v7(),
  user_id uuid references public.users (id) on delete set null,
  first_name text,
  last_name text,
  phone text,
  email text,
  preferred_language text not null default 'en',
  marketing_opt_in boolean not null default false,
  lifetime_value numeric(12, 2) not null default 0,
  total_orders integer not null default 0,
  average_order_value numeric(12, 2) not null default 0,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index idx_customers_user_id on public.customers (user_id) where user_id is not null;
create index idx_customers_email on public.customers (email);
create index idx_customers_phone on public.customers (phone);
create trigger trg_touch_row before update on public.customers
  for each row execute function private.touch_row();

-- customer_addresses — §32.
create table public.customer_addresses (
  id uuid primary key default uuid_generate_v7(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  state text,
  country text not null default 'IN',
  postal_code text not null,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  is_default boolean not null default false,
  delivery_notes text,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_customer_addresses_customer_id on public.customer_addresses (customer_id);
create index idx_customer_addresses_postal_code on public.customer_addresses (postal_code);
create trigger trg_touch_row before update on public.customer_addresses
  for each row execute function private.touch_row();

-- coupons — not specified in Ch.10 (see file header). Business rules from
-- Ch.8 §8.11 and Ch.9 (types, validation chain, per-user limits).
create table public.coupons (
  id uuid primary key default uuid_generate_v7(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed', 'free_delivery', 'free_gift')),
  discount_value numeric(12, 2) not null default 0 check (discount_value >= 0),
  max_discount_amount numeric(12, 2),
  min_cart_value numeric(12, 2) not null default 0,
  usage_limit_total integer,
  usage_limit_per_user integer,
  times_used integer not null default 0,
  applicable_category_id uuid references public.categories (id),
  applicable_product_id uuid references public.products (id),
  applicable_outlet_id uuid references public.outlets (id),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_coupons_code on public.coupons (code);
create index idx_coupons_active on public.coupons (active);
create trigger trg_touch_row before update on public.coupons
  for each row execute function private.touch_row();

-- coupon_redemptions — enforces per-user usage limits; append-only.
create table public.coupon_redemptions (
  id uuid primary key default uuid_generate_v7(),
  coupon_id uuid not null references public.coupons (id),
  customer_id uuid not null references public.customers (id),
  order_id uuid,
  redeemed_at timestamptz not null default now()
);

create index idx_coupon_redemptions_coupon_id on public.coupon_redemptions (coupon_id);
create index idx_coupon_redemptions_customer_id on public.coupon_redemptions (customer_id);

-- offers — not specified in Ch.10 (see file header). Priority ladder and
-- BXGY/free-gift/free-delivery types from Ch.9.
create table public.offers (
  id uuid primary key default uuid_generate_v7(),
  name text not null,
  description text,
  offer_type text not null check (offer_type in ('percentage', 'fixed', 'buy_x_get_y', 'free_gift', 'free_delivery')),
  priority integer not null default 6,
  conditions jsonb not null default '{}',
  reward jsonb not null default '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_offers_active on public.offers (active);
create index idx_offers_priority on public.offers (priority);
create trigger trg_touch_row before update on public.offers
  for each row execute function private.touch_row();

-- reviews — not specified in Ch.10 (see file header); ERD (§23) and Ch.8/
-- Ch.16 business rules (verified purchase, moderation) inform this shape.
create table public.reviews (
  id uuid primary key default uuid_generate_v7(),
  product_id uuid not null references public.products (id) on delete cascade,
  customer_id uuid not null references public.customers (id),
  order_id uuid,
  rating integer not null check (rating between 1 and 5),
  title text,
  comment text,
  verified_purchase boolean not null default false,
  status review_status not null default 'pending',
  helpful_count integer not null default 0,
  moderated_by uuid references public.users (id),
  moderated_at timestamptz,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_reviews_product_id on public.reviews (product_id);
create index idx_reviews_customer_id on public.reviews (customer_id);
create index idx_reviews_status on public.reviews (status);
create trigger trg_touch_row before update on public.reviews
  for each row execute function private.touch_row();
