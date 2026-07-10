-- RLS — Order, Payment, Checkout, Delivery & Invoice Domain.
--
-- Design decision: all writes to this domain (checkout_sessions, orders,
-- order_items, payments, refunds, deliveries, invoices, order_events) are
-- service_role-only. No anon/authenticated INSERT/UPDATE policy is granted
-- anywhere in this file — that is deliberate, not an oversight. The
-- handbook is explicit and repeated on this point: "Frontend success alone
-- never creates an Order" (§47), every checkout/payment-verification step
-- runs inside a backend database transaction (§54), and "Server is the
-- source of truth" (Ch.8 §8.2). Guest checkout (Ch.8: "never force
-- registration") therefore also goes through the backend's service_role,
-- since a true guest has no Supabase Auth session (auth.uid() is null) and
-- could never satisfy an ownership check anyway. Authenticated customers
-- get read-only access to their own historical records; nothing more.

alter table public.checkout_sessions enable row level security;
alter table public.checkout_sessions force row level security;

create policy checkout_sessions_select_own on public.checkout_sessions
  for select to authenticated
  using (customer_id = private.current_customer_id());

create policy checkout_sessions_admin_all on public.checkout_sessions
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

alter table public.orders enable row level security;
alter table public.orders force row level security;

create policy orders_select_own on public.orders
  for select to authenticated
  using (customer_id = private.current_customer_id());

create policy orders_admin_all on public.orders
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

alter table public.order_items enable row level security;
alter table public.order_items force row level security;

create policy order_items_select_own on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.customer_id = private.current_customer_id()
    )
  );

create policy order_items_admin_all on public.order_items
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- payments: no direct customer read — gateway signatures/ids are sensitive.
-- Customers already see payment_status via orders.
alter table public.payments enable row level security;
alter table public.payments force row level security;
create policy payments_admin_all on public.payments
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

alter table public.refunds enable row level security;
alter table public.refunds force row level security;

create policy refunds_select_own on public.refunds
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = refunds.order_id
        and o.customer_id = private.current_customer_id()
    )
  );

create policy refunds_admin_all on public.refunds
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- delivery_groups / delivery_slots: public read so checkout can present
-- available slots; admin manages capacity/schedule.
alter table public.delivery_groups enable row level security;
alter table public.delivery_groups force row level security;

create policy delivery_groups_select_public on public.delivery_groups
  for select to anon, authenticated
  using (active = true);

create policy delivery_groups_admin_all on public.delivery_groups
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

alter table public.delivery_slots enable row level security;
alter table public.delivery_slots force row level security;

create policy delivery_slots_select_public on public.delivery_slots
  for select to anon, authenticated
  using (is_active = true);

create policy delivery_slots_admin_all on public.delivery_slots
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

alter table public.deliveries enable row level security;
alter table public.deliveries force row level security;

create policy deliveries_select_own on public.deliveries
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = deliveries.order_id
        and o.customer_id = private.current_customer_id()
    )
  );

create policy deliveries_admin_all on public.deliveries
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

alter table public.invoices enable row level security;
alter table public.invoices force row level security;

create policy invoices_select_own on public.invoices
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = invoices.order_id
        and o.customer_id = private.current_customer_id()
    )
  );

create policy invoices_admin_all on public.invoices
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- order_events: lets the storefront render an order-tracking timeline.
alter table public.order_events enable row level security;
alter table public.order_events force row level security;

create policy order_events_select_own on public.order_events
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_events.order_id
        and o.customer_id = private.current_customer_id()
    )
  );

create policy order_events_admin_all on public.order_events
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());
