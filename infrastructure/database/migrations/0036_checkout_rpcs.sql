-- Ch.8 §88-113 Checkout & Payment Domain. Every write here crosses
-- multiple tables (inventory + checkout_sessions on start; orders +
-- order_items + inventory + payments + order_events + checkout_sessions
-- on complete) — same atomicity rule as every prior RPC in this project
-- (see packages/core/src/repository.ts, migration 0020's precedent).
--
-- Principle 2 (Ch.8 §89): "Never oversell. Inventory must be checked
-- again immediately before reservation" — enforced with `for update` row
-- locks, identical technique to claim_next_job's `for update skip locked`.

create or replace function public.checkout_start(
  p_customer_id uuid,
  p_items jsonb, -- [{product_id, sku, name, quantity, unit_price}]
  p_outlet_id uuid,
  p_address_snapshot jsonb,
  p_pricing_snapshot jsonb,
  p_cart_snapshot jsonb,
  p_selected_delivery_slot uuid default null,
  p_coupon_snapshot jsonb default '{}'::jsonb,
  p_reservation_minutes integer default 15
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
  -- Reserve inventory for every line item, one row lock at a time, in a
  -- stable order (by product_id) to avoid deadlocking against a
  -- concurrent checkout reserving the same products in a different order.
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
    selected_delivery_slot, selected_outlet, reservation_expires_at, status
  ) values (
    p_customer_id, p_cart_snapshot, p_pricing_snapshot, p_address_snapshot, p_coupon_snapshot,
    p_selected_delivery_slot, p_outlet_id, now() + make_interval(mins => p_reservation_minutes), 'validated'
  )
  returning * into v_session;

  return v_session;
end;
$$;

revoke all on function public.checkout_start from public, anon, authenticated;
grant execute on function public.checkout_start to service_role;

-- checkout_complete — Ch.8 §101/§103. Called only after the payment
-- webhook's signature has already been verified at the application
-- layer (server/payments/razorpay-adapter.ts); this function trusts its
-- caller on that point and focuses on the atomic multi-table write plus
-- its own idempotency guard (Ch.8 §102: duplicate webhook delivery must
-- never create a duplicate order).
create or replace function public.checkout_complete(
  p_checkout_session_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_razorpay_signature text,
  p_amount numeric
)
returns public.orders
language plpgsql
as $$
declare
  v_session public.checkout_sessions;
  v_existing_order public.orders;
  v_existing_payment_order_id uuid;
  v_item jsonb;
  v_inventory_id uuid;
  v_available integer;
  v_order public.orders;
  v_order_number text;
  v_invoice_id uuid;
begin
  -- Idempotency short-circuit: this exact Razorpay payment was already processed.
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

  -- Session already completed by a prior (differently-keyed) webhook delivery for the same session.
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

  v_order_number := public.generate_order_number();

  insert into public.orders (
    order_number, customer_id, outlet_id, checkout_session_id, status, payment_status,
    fulfillment_status, subtotal, discount_total, coupon_discount, delivery_fee, tax_total,
    grand_total, currency, order_snapshot
  ) values (
    v_order_number, v_session.customer_id, v_session.selected_outlet, v_session.id, 'paid', 'captured',
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
      'coupon', v_session.coupon_snapshot
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
    v_order.id, v_session.id, 'razorpay', p_razorpay_order_id, p_razorpay_payment_id,
    p_razorpay_signature, p_amount, 'INR', 'captured', true, now(), p_razorpay_payment_id
  );

  insert into public.invoices (order_id, invoice_number, tax_breakdown)
  values (
    v_order.id, 'INV-' || v_order.order_number, jsonb_build_object('taxTotal', v_order.tax_total)
  )
  returning id into v_invoice_id;

  insert into public.order_events (order_id, event_type, old_state, new_state, source)
  values (v_order.id, 'order.created', null, 'paid', 'webhook');

  update public.checkout_sessions set status = 'completed' where id = v_session.id;

  return v_order;
end;
$$;

revoke all on function public.checkout_complete from public, anon, authenticated;
grant execute on function public.checkout_complete to service_role;

-- checkout_cancel — payment.failed webhook or expiry sweep. Releases
-- reserved inventory back; idempotent no-op if the session is already
-- completed or already cancelled/expired.
create or replace function public.checkout_cancel(
  p_checkout_session_id uuid,
  p_new_status checkout_session_status default 'cancelled'
)
returns void
language plpgsql
as $$
declare
  v_session public.checkout_sessions;
  v_item jsonb;
  v_inventory_id uuid;
  v_available integer;
begin
  select * into v_session from public.checkout_sessions where id = p_checkout_session_id for update;
  if not found or v_session.status in ('completed', 'cancelled', 'expired') then
    return;
  end if;

  for v_item in select * from jsonb_array_elements(v_session.cart_snapshot->'items')
  loop
    select id, available_quantity into v_inventory_id, v_available
    from public.inventory
    where product_id = (v_item->>'product_id')::uuid and outlet_id = v_session.selected_outlet
    for update;

    if v_inventory_id is not null then
      update public.inventory
      set reserved_quantity = greatest(reserved_quantity - (v_item->>'quantity')::integer, 0)
      where id = v_inventory_id;

      insert into public.inventory_transactions (
        inventory_id, transaction_type, quantity, previous_quantity, new_quantity, reason
      ) values (
        v_inventory_id, 'reservation_release', -(v_item->>'quantity')::integer,
        v_available, v_available + (v_item->>'quantity')::integer, 'Checkout cancelled/expired'
      );
    end if;
  end loop;

  update public.checkout_sessions set status = p_new_status where id = v_session.id;
end;
$$;

revoke all on function public.checkout_cancel from public, anon, authenticated;
grant execute on function public.checkout_cancel to service_role;
