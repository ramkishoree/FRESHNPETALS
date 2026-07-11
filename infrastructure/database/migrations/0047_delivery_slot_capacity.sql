-- Ch.8 §95: delivery_slots.max_capacity/current_bookings have existed
-- since the schema was first written, with a check constraint
-- (current_bookings <= max_capacity) that's real and enforced — but
-- checkout_start never incremented current_bookings when a slot was
-- selected, so the constraint was never actually exercised, and a slot
-- could be booked past capacity with no error at all. checkout_cancel
-- correspondingly never released a slot on cancellation/expiry.

create or replace function public.checkout_start(
  p_customer_id uuid,
  p_items jsonb,
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
  v_slot_capacity integer;
  v_slot_bookings integer;
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

  -- Ch.8 §95 Delivery Slot Capacity — locked and checked the same way
  -- inventory is above, so two concurrent checkouts can't both slip past
  -- the last remaining slot.
  if p_selected_delivery_slot is not null then
    select max_capacity, current_bookings into v_slot_capacity, v_slot_bookings
    from public.delivery_slots
    where id = p_selected_delivery_slot and is_active = true
    for update;

    if v_slot_capacity is null then
      raise exception 'Delivery slot % is not available', p_selected_delivery_slot
        using errcode = 'P0005';
    end if;

    if v_slot_bookings >= v_slot_capacity then
      raise exception 'Delivery slot % is fully booked', p_selected_delivery_slot
        using errcode = 'P0006';
    end if;

    update public.delivery_slots
    set current_bookings = current_bookings + 1
    where id = p_selected_delivery_slot;
  end if;

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

-- checkout_cancel now also releases a booked delivery slot, mirroring the
-- inventory release right below it — same principle, same function,
-- since a cancelled/expired session must give back everything it held.
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

  if v_session.selected_delivery_slot is not null then
    update public.delivery_slots
    set current_bookings = greatest(current_bookings - 1, 0)
    where id = v_session.selected_delivery_slot;
  end if;

  update public.checkout_sessions set status = p_new_status where id = v_session.id;
end;
$$;

revoke all on function public.checkout_cancel from public, anon, authenticated;
grant execute on function public.checkout_cancel to service_role;
