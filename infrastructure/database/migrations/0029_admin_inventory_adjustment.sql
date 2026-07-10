-- Ch.16 §95 (Inventory Management API) + Ch.8 §45 ("no inventory changes
-- occur silently") — adjusting stock and recording the transaction that
-- explains it must be atomic (same rationale as 0025's product writes).

create or replace function public.admin_adjust_inventory(
  p_inventory_id uuid,
  p_transaction_type inventory_transaction_type,
  p_quantity_delta integer,
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
  select physical_quantity into v_previous
  from public.inventory
  where id = p_inventory_id
  for update;

  if not found then
    raise exception 'No inventory row %', p_inventory_id;
  end if;

  update public.inventory
  set physical_quantity = physical_quantity + p_quantity_delta, updated_by = p_actor_id
  where id = p_inventory_id
  returning * into v_updated;

  insert into public.inventory_transactions (
    inventory_id, transaction_type, quantity, previous_quantity, new_quantity, reason, administrator_id
  ) values (
    p_inventory_id, p_transaction_type, p_quantity_delta, v_previous, v_updated.physical_quantity, p_reason, p_actor_id
  );

  return v_updated;
end;
$$;

comment on function public.admin_adjust_inventory is
  'Atomically adjusts inventory.physical_quantity and appends the explaining inventory_transactions row (Ch.8 §45). Admin API only.';

revoke all on function public.admin_adjust_inventory from public, anon, authenticated;
grant execute on function public.admin_adjust_inventory to service_role;
