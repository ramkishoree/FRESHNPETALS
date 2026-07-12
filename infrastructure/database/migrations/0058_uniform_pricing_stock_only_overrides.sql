-- Owner's explicit call: price, sale price, and photo stay uniform across
-- every outlet — only physical stock varies per outlet. The per-outlet
-- price/photo override feature (migration 0057) is removed entirely
-- rather than left unused.
drop table if exists public.product_outlet_overrides;

-- Every product/outlet pair has no `inventory` row until an admin manually
-- adjusts stock for it once (admin_create_product never seeds one) — the
-- existing admin_adjust_inventory RPC only updates an existing row and
-- raises if none is found, which is why the per-outlet stock field in the
-- Products tab silently did nothing for a brand-new product/outlet pair.
-- This RPC sets (not deltas) the stock and creates the row on first use.
create or replace function public.admin_set_inventory_stock(
  p_product_id uuid,
  p_outlet_id uuid,
  p_new_quantity integer,
  p_actor_id uuid,
  p_reason text default null
)
returns public.inventory
language plpgsql
as $$
declare
  v_previous integer;
  v_updated public.inventory;
begin
  if p_new_quantity < 0 then
    raise exception 'Stock quantity cannot be negative';
  end if;

  select physical_quantity into v_previous
  from public.inventory
  where product_id = p_product_id and outlet_id = p_outlet_id
  for update;

  if not found then
    insert into public.inventory (product_id, outlet_id, physical_quantity, updated_by)
    values (p_product_id, p_outlet_id, p_new_quantity, p_actor_id)
    returning * into v_updated;
    v_previous := 0;
  else
    update public.inventory
    set physical_quantity = p_new_quantity, updated_by = p_actor_id
    where product_id = p_product_id and outlet_id = p_outlet_id
    returning * into v_updated;
  end if;

  insert into public.inventory_transactions (
    inventory_id, transaction_type, quantity, previous_quantity, new_quantity, reason, administrator_id
  ) values (
    v_updated.id, 'correction', p_new_quantity - v_previous, v_previous, v_updated.physical_quantity, p_reason, p_actor_id
  );

  return v_updated;
end;
$$;

comment on function public.admin_set_inventory_stock is
  'Sets (not deltas) an outlet''s physical stock for a product, creating the inventory row on first use. Admin API only.';

revoke all on function public.admin_set_inventory_stock from public, anon, authenticated;
grant execute on function public.admin_set_inventory_stock to service_role;
