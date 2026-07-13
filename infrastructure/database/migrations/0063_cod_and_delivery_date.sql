-- Owner's explicit call: add Cash on Delivery as a real checkout path,
-- and capture the customer's actually-selected delivery date (the slot
-- picker has always stored *which template slot* — "9 AM-11 AM" — but
-- never *which calendar day*, since the same slot repeats daily with no
-- per-date row). Both land in order_snapshot.delivery alongside the
-- slot's own label/times, next to the existing checkout/address/
-- pricing/coupon snapshot keys, so the order detail page can show
-- "order date, selected delivery date, selected time" without a join.

alter table public.checkout_sessions add column selected_delivery_date date;

alter table public.orders
  add column payment_method text not null default 'razorpay'
  check (payment_method in ('razorpay', 'cod'));

-- CREATE OR REPLACE does not replace a function whose parameter list
-- differs (even by one new trailing defaulted param) — it creates a
-- second overload instead, leaving the old one live and ambiguous for
-- the `revoke`/`grant` below. Drop the exact old signatures first.
drop function if exists public.checkout_start(
  uuid, jsonb, uuid, jsonb, jsonb, jsonb, uuid, jsonb, integer
);
drop function if exists public.checkout_complete(uuid, text, text, text, numeric);

create or replace function public.checkout_start(
  p_customer_id uuid,
  p_items jsonb, -- [{product_id, sku, name, quantity, unit_price}]
  p_outlet_id uuid,
  p_address_snapshot jsonb,
  p_pricing_snapshot jsonb,
  p_cart_snapshot jsonb,
  p_selected_delivery_slot uuid default null,
  p_coupon_snapshot jsonb default '{}'::jsonb,
  p_reservation_minutes integer default 15,
  p_delivery_date date default null
)
returns public.checkout_sessions
language plpgsql
as $$
declare
  v_item jsonb;
  v_inventory_id uuid;
  v_available integer;
  v_session public.checkout_sessions;
begin
  for v_item in
    select * from jsonb_array_elements(p_items) order by (value->>'product_id')
  loop
    select id, available_quantity into v_inventory_id, v_available
    from public.inventory
    where product_id = (v_item->>'product_id')::uuid
      and outlet_id = p_outlet_id
    for update;

    if v_inventory_id is null then
      raise exception 'No inventory row for product % at outlet %', v_item->>'product_id', p_outlet_id
        using errcode = 'P0001';
    end if;

    if v_available < (v_item->>'quantity')::integer then
      raise exception 'Insufficient inventory for product % (available %, requested %)',
        v_item->>'product_id', v_available, v_item->>'quantity'
        using errcode = 'P0002';
    end if;

    update public.inventory
    set reserved_quantity = reserved_quantity + (v_item->>'quantity')::integer
    where id = v_inventory_id;

    insert into public.inventory_transactions (
      inventory_id, transaction_type, quantity, previous_quantity, new_quantity, reason
    ) values (
      v_inventory_id, 'reservation', (v_item->>'quantity')::integer,
      v_available, v_available - (v_item->>'quantity')::integer, 'Checkout reservation'
    );
  end loop;

  insert into public.checkout_sessions (
    customer_id, cart_snapshot, pricing_snapshot, address_snapshot, coupon_snapshot,
    selected_delivery_slot, selected_delivery_date, selected_outlet, reservation_expires_at, status
  ) values (
    p_customer_id, p_cart_snapshot, p_pricing_snapshot, p_address_snapshot, p_coupon_snapshot,
    p_selected_delivery_slot, p_delivery_date, p_outlet_id, now() + make_interval(mins => p_reservation_minutes), 'validated'
  )
  returning * into v_session;

  return v_session;
end;
$$;

revoke all on function public.checkout_start from public, anon, authenticated;
grant execute on function public.checkout_start to service_role;

create or replace function public.checkout_complete(
  p_checkout_session_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_razorpay_signature text,
  p_amount numeric,
  p_payment_method text default 'razorpay'
)
returns public.orders
language plpgsql
as $$
declare
  v_session public.checkout_sessions;
  v_existing_order public.orders;
  v_item jsonb;
  v_inventory_id uuid;
  v_available integer;
  v_order public.orders;
  v_order_number text;
  v_invoice_id uuid;
  v_order_status public.order_status;
  v_payment_status public.payment_status;
  v_slot_label text;
  v_slot_start time;
  v_slot_end time;
begin
  -- Idempotency short-circuit for the Razorpay path: this exact payment
  -- was already processed. p_razorpay_payment_id is null for COD, so
  -- this comparison is never true there — COD's idempotency is the
  -- session-status check below instead (a session can only ever
  -- complete once, same guard both paths rely on).
  select o.* into v_existing_order
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.idempotency_key = p_razorpay_payment_id;

  if found then
    return v_existing_order;
  end if;

  select * into v_session from public.checkout_sessions where id = p_checkout_session_id for update;
  if not found then
    raise exception 'No checkout session %', p_checkout_session_id using errcode = 'P0003';
  end if;

  if v_session.status = 'completed' then
    select * into v_existing_order from public.orders where checkout_session_id = p_checkout_session_id;
    if found then
      return v_existing_order;
    end if;
  end if;

  if v_session.status not in ('validated', 'payment_pending') then
    raise exception 'Checkout session % is not payable (status %)', p_checkout_session_id, v_session.status
      using errcode = 'P0004';
  end if;

  if p_payment_method = 'cod' then
    v_order_status := 'confirmed';
    v_payment_status := 'cod_pending';
  else
    v_order_status := 'paid';
    v_payment_status := 'captured';
  end if;

  if v_session.selected_delivery_slot is not null then
    select label, start_time, end_time into v_slot_label, v_slot_start, v_slot_end
    from public.delivery_slots where id = v_session.selected_delivery_slot;
  end if;

  v_order_number := public.generate_order_number();

  insert into public.orders (
    order_number, customer_id, outlet_id, checkout_session_id, status, payment_status,
    payment_method, fulfillment_status, subtotal, discount_total, coupon_discount, delivery_fee,
    tax_total, grand_total, currency, order_snapshot
  ) values (
    v_order_number, v_session.customer_id, v_session.selected_outlet, v_session.id,
    v_order_status, v_payment_status, p_payment_method,
    'unfulfilled',
    coalesce((v_session.pricing_snapshot->>'subtotal')::numeric, 0),
    coalesce((v_session.pricing_snapshot->>'discountTotal')::numeric, 0),
    coalesce((v_session.pricing_snapshot->>'couponDiscount')::numeric, 0),
    coalesce((v_session.pricing_snapshot->>'deliveryFee')::numeric, 0),
    coalesce((v_session.pricing_snapshot->>'taxTotal')::numeric, 0),
    coalesce((v_session.pricing_snapshot->>'grandTotal')::numeric, p_amount),
    'INR',
    jsonb_build_object(
      'checkout', v_session.cart_snapshot,
      'address', v_session.address_snapshot,
      'pricing', v_session.pricing_snapshot,
      'coupon', v_session.coupon_snapshot,
      'delivery', jsonb_build_object(
        'date', v_session.selected_delivery_date,
        'slotLabel', v_slot_label,
        'startTime', v_slot_start,
        'endTime', v_slot_end
      )
    )
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(v_session.cart_snapshot->'items')
  loop
    insert into public.order_items (
      order_id, product_id, sku, product_name, quantity, unit_price, line_total, product_snapshot
    ) values (
      v_order.id, (v_item->>'product_id')::uuid, v_item->>'sku', v_item->>'name',
      (v_item->>'quantity')::integer, (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::integer * (v_item->>'unit_price')::numeric, v_item
    );

    select id, available_quantity into v_inventory_id, v_available
    from public.inventory
    where product_id = (v_item->>'product_id')::uuid and outlet_id = v_session.selected_outlet
    for update;

    update public.inventory
    set physical_quantity = physical_quantity - (v_item->>'quantity')::integer,
        reserved_quantity = reserved_quantity - (v_item->>'quantity')::integer
    where id = v_inventory_id;

    insert into public.inventory_transactions (
      inventory_id, transaction_type, quantity, previous_quantity, new_quantity, reason, order_id
    ) values (
      v_inventory_id, 'sale', -(v_item->>'quantity')::integer,
      v_available, v_available - (v_item->>'quantity')::integer, 'Order completed', v_order.id
    );
  end loop;

  insert into public.payments (
    order_id, checkout_session_id, gateway, gateway_order_id, gateway_payment_id,
    gateway_signature, amount, currency, status, verified, webhook_received_at, idempotency_key
  ) values (
    v_order.id, v_session.id, p_payment_method, p_razorpay_order_id, p_razorpay_payment_id,
    p_razorpay_signature, p_amount, 'INR', v_payment_status, true, now(),
    -- COD has no external payment id to key off; the session id is
    -- unique and this function can only ever complete a given session
    -- once (guarded above), so it's a safe, stable idempotency key.
    coalesce(p_razorpay_payment_id, 'cod-' || v_session.id::text)
  );

  insert into public.invoices (order_id, invoice_number, tax_breakdown)
  values (
    v_order.id, 'INV-' || v_order.order_number, jsonb_build_object('taxTotal', v_order.tax_total)
  )
  returning id into v_invoice_id;

  insert into public.order_events (order_id, event_type, old_state, new_state, source)
  values (v_order.id, 'order.created', null, v_order_status::text, 'webhook');

  update public.checkout_sessions set status = 'completed' where id = v_session.id;

  return v_order;
end;
$$;

revoke all on function public.checkout_complete from public, anon, authenticated;
grant execute on function public.checkout_complete to service_role;
