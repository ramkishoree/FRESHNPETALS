-- Ch.8 §41: "Reservation expires automatically." checkout_start (0036) sets
-- reservation_expires_at on every session, and checkout_cancel already
-- knows how to release a single session's reserved inventory — but
-- nothing ever calls it for a session the customer simply abandoned
-- (no payment.failed webhook fires for a checkout nobody attempted to
-- pay). Until now, an abandoned checkout held its reserved stock forever.
--
-- This adds the sweep half: find every session past its expiry that's
-- still sitting in a reservable state, and release each one through the
-- exact same checkout_cancel() path a real cancellation uses — no new
-- release logic to keep in sync with it.

create or replace function public.checkout_expire_stale_sessions(p_batch_limit integer default 200)
returns integer
language plpgsql
as $$
declare
  v_session_id uuid;
  v_count integer := 0;
begin
  for v_session_id in
    select id from public.checkout_sessions
    where status in ('validated', 'payment_pending')
      and reservation_expires_at is not null
      and reservation_expires_at < now()
    order by reservation_expires_at
    limit p_batch_limit
  loop
    perform public.checkout_cancel(v_session_id, 'expired');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.checkout_expire_stale_sessions from public, anon, authenticated;
grant execute on function public.checkout_expire_stale_sessions to service_role;
