-- Ch.8 §74/§102: a coupon's `times_used` and `coupon_redemptions` history
-- must advance atomically with the order it was used on, or a duplicate
-- webhook / retry could double-count (or never count) a redemption.
-- checkout_complete's idempotency short-circuit already prevents this
-- block from running twice for the same payment.

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
  v_item jsonb;
  v_inventory_id uuid;
  v_available integer;
  v_order public.orders;
  v_order_number text;
  v_invoice_id uuid;
  v_coupon_id uuid;
begin
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

  -- Ch.8 §74: record the redemption and advance the coupon's usage count
  -- in the same transaction as the order it paid for.
  if v_session.coupon_snapshot ? 'id' then
    v_coupon_id := (v_session.coupon_snapshot->>'id')::uuid;
    update public.coupons set times_used = times_used + 1 where id = v_coupon_id;
    insert into public.coupon_redemptions (coupon_id, customer_id, order_id)
    values (v_coupon_id, v_session.customer_id, v_order.id);
  end if;

  insert into public.order_events (order_id, event_type, old_state, new_state, source)
  values (v_order.id, 'order.created', null, 'paid', 'webhook');

  update public.checkout_sessions set status = 'completed' where id = v_session.id;

  return v_order;
end;
$$;

revoke all on function public.checkout_complete from public, anon, authenticated;
grant execute on function public.checkout_complete to service_role;
