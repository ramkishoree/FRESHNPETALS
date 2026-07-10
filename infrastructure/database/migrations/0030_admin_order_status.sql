-- Ch.8 §105: "Every transition generates Audit Log, Notification,
-- Analytics Event." `order_events` (Ch.10 §53) is the append-only
-- timeline that already backs OrderTimeline (Phase 7); the status write
-- and its explaining event must land in the same transaction (same
-- rationale as 0025/0029).

create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_new_status order_status,
  p_actor_id uuid,
  p_notes text default null
)
returns public.orders
language plpgsql
as $$
declare
  v_old_status order_status;
  v_updated public.orders;
begin
  select status into v_old_status from public.orders where id = p_order_id for update;

  if not found then
    raise exception 'No order %', p_order_id;
  end if;

  update public.orders
  set status = p_new_status
  where id = p_order_id
  returning * into v_updated;

  insert into public.order_events (order_id, event_type, old_state, new_state, actor, source, metadata)
  values (
    p_order_id, 'admin.order.status_changed', v_old_status, p_new_status, p_actor_id, 'admin',
    case when p_notes is not null then jsonb_build_object('notes', p_notes) else '{}'::jsonb end
  );

  return v_updated;
end;
$$;

comment on function public.admin_update_order_status is
  'Atomically transitions orders.status and appends the explaining order_events row (Ch.8 §105). Admin API only.';

revoke all on function public.admin_update_order_status from public, anon, authenticated;
grant execute on function public.admin_update_order_status to service_role;
