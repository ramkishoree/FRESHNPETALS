-- Order, Payment, Checkout, Delivery & Invoice Domain — Ch.10 Part 3 (§39-60).
-- Orders/payments/invoices are immutable financial records (§34: deleting an
-- order or payment is Forbidden). They intentionally do NOT get
-- created_by/updated_by/deleted_at from the §16 universal-column rule —
-- attribution for financial records lives in the append-only order_events
-- timeline instead, which is the more correct audit trail for a "never
-- overwritten" record (§Principle 3). They do keep `version` for optimistic
-- concurrency on the status-transition columns, which are the one thing
-- that legitimately mutates after creation.

-- checkout_sessions — §45. A customer row always exists by checkout start,
-- even for guests (see 0005 customers.user_id nullability decision), so
-- customer_id is NOT NULL here.
create table public.checkout_sessions (
  id uuid primary key default uuid_generate_v7(),
  customer_id uuid not null references public.customers (id),
  cart_snapshot jsonb not null default '{}',
  pricing_snapshot jsonb not null default '{}',
  address_snapshot jsonb not null default '{}',
  selected_delivery_slot uuid,
  selected_outlet uuid references public.outlets (id),
  reservation_expires_at timestamptz not null,
  status checkout_session_status not null default 'draft',
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_checkout_sessions_customer_id on public.checkout_sessions (customer_id);
create index idx_checkout_sessions_status on public.checkout_sessions (status);
create index idx_checkout_sessions_reservation_expires_at on public.checkout_sessions (reservation_expires_at);
create trigger trg_touch_row before update on public.checkout_sessions
  for each row execute function private.touch_row();

-- orders — §41. Immutable except lifecycle status columns.
create table public.orders (
  id uuid primary key default uuid_generate_v7(),
  order_number text not null unique,
  customer_id uuid not null references public.customers (id),
  outlet_id uuid not null references public.outlets (id),
  checkout_session_id uuid not null references public.checkout_sessions (id),
  status order_status not null default 'pending_payment',
  payment_status payment_status not null default 'created',
  fulfillment_status fulfillment_status not null default 'unfulfilled',
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  discount_total numeric(12, 2) not null default 0,
  coupon_discount numeric(12, 2) not null default 0,
  delivery_fee numeric(12, 2) not null default 0,
  tax_total numeric(12, 2) not null default 0,
  grand_total numeric(12, 2) not null check (grand_total >= 0),
  currency char(3) not null default 'INR',
  order_snapshot jsonb not null,
  notes text,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_order_number on public.orders (order_number);
create index idx_orders_customer_id on public.orders (customer_id);
create index idx_orders_status on public.orders (status);
create index idx_orders_payment_status on public.orders (payment_status);
create index idx_orders_outlet_id on public.orders (outlet_id);
create index idx_orders_created_at on public.orders (created_at desc);
create index idx_orders_snapshot_gin on public.orders using gin (order_snapshot);
create trigger trg_touch_row before update on public.orders
  for each row execute function private.touch_row();

-- order_items — §44. Never rejoin products to reconstruct an invoice;
-- product_snapshot + the columns below are the historical record.
create table public.order_items (
  id uuid primary key default uuid_generate_v7(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id),
  sku text not null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  discount numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null check (line_total >= 0),
  product_snapshot jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_order_items_order_id on public.order_items (order_id);
create index idx_order_items_product_id on public.order_items (product_id);
create index idx_order_items_sku on public.order_items (sku);

-- payments — §46. Not every payment results in an order.
create table public.payments (
  id uuid primary key default uuid_generate_v7(),
  order_id uuid references public.orders (id),
  checkout_session_id uuid not null references public.checkout_sessions (id),
  gateway text not null default 'razorpay',
  gateway_order_id text,
  gateway_payment_id text,
  gateway_signature text,
  amount numeric(12, 2) not null check (amount >= 0),
  currency char(3) not null default 'INR',
  status payment_status not null default 'created',
  method text,
  failure_reason text,
  verified boolean not null default false,
  webhook_received_at timestamptz,
  idempotency_key text not null,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

create unique index idx_payments_gateway_payment_id on public.payments (gateway_payment_id) where gateway_payment_id is not null;
create index idx_payments_gateway_order_id on public.payments (gateway_order_id);
create index idx_payments_status on public.payments (status);
create index idx_payments_created_at on public.payments (created_at desc);
create trigger trg_touch_row before update on public.payments
  for each row execute function private.touch_row();

-- refunds — §48. Never modifies the original payment row.
create table public.refunds (
  id uuid primary key default uuid_generate_v7(),
  payment_id uuid not null references public.payments (id),
  order_id uuid not null references public.orders (id),
  amount numeric(12, 2) not null check (amount >= 0),
  reason text,
  status refund_status not null default 'requested',
  gateway_refund_id text,
  requested_by uuid references public.users (id),
  approved_by uuid references public.users (id),
  processed_at timestamptz,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_refunds_payment_id on public.refunds (payment_id);
create index idx_refunds_order_id on public.refunds (order_id);
create index idx_refunds_status on public.refunds (status);
create trigger trg_touch_row before update on public.refunds
  for each row execute function private.touch_row();

-- delivery_groups — §49.
create table public.delivery_groups (
  id uuid primary key default uuid_generate_v7(),
  name text not null,
  description text,
  default_slot_duration_minutes integer not null default 60,
  preparation_time_minutes integer not null default 30,
  same_day_allowed boolean not null default true,
  active boolean not null default true,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_touch_row before update on public.delivery_groups
  for each row execute function private.touch_row();

-- delivery_slots — §50. Capacity validation prevents overbooking.
create table public.delivery_slots (
  id uuid primary key default uuid_generate_v7(),
  delivery_group_id uuid not null references public.delivery_groups (id),
  label text not null,
  start_time time not null,
  end_time time not null,
  max_capacity integer not null check (max_capacity > 0),
  current_bookings integer not null default 0,
  is_active boolean not null default true,
  holiday_override jsonb,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_delivery_slots_capacity check (current_bookings >= 0 and current_bookings <= max_capacity)
);

create index idx_delivery_slots_group_id on public.delivery_slots (delivery_group_id);
alter table public.checkout_sessions
  add constraint fk_checkout_sessions_delivery_slot foreign key (selected_delivery_slot) references public.delivery_slots (id);
create trigger trg_touch_row before update on public.delivery_slots
  for each row execute function private.touch_row();

-- deliveries — §51.
create table public.deliveries (
  id uuid primary key default uuid_generate_v7(),
  order_id uuid not null references public.orders (id),
  outlet_id uuid not null references public.outlets (id),
  assigned_to uuid references public.users (id),
  status delivery_status not null default 'pending',
  estimated_delivery timestamptz,
  actual_delivery timestamptz,
  tracking_code text,
  proof_of_delivery_url text,
  delivery_notes text,
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_deliveries_order_id on public.deliveries (order_id);
create index idx_deliveries_outlet_id on public.deliveries (outlet_id);
create index idx_deliveries_status on public.deliveries (status);
create trigger trg_touch_row before update on public.deliveries
  for each row execute function private.touch_row();

-- invoices — §52. Regeneration inserts a new version row; never replaces
-- Version 1 (or any prior version) in place.
create table public.invoices (
  id uuid primary key default uuid_generate_v7(),
  order_id uuid not null references public.orders (id),
  invoice_number text not null unique,
  invoice_url text,
  gstin text,
  tax_breakdown jsonb not null default '{}',
  issued_at timestamptz not null default now(),
  version integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (order_id, version)
);

create index idx_invoices_order_id on public.invoices (order_id);

-- order_events — §53. Append-only timeline; every status change is one row.
create table public.order_events (
  id uuid primary key default uuid_generate_v7(),
  order_id uuid not null references public.orders (id),
  event_type text not null,
  old_state text,
  new_state text,
  actor uuid references public.users (id),
  source text not null default 'system',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_order_events_order_id on public.order_events (order_id);
create index idx_order_events_created_at on public.order_events (created_at desc);
