-- Ch.8 §91 Checkout Session fields list "Coupon Snapshot" alongside Cart/
-- Price/Address Snapshot — the other three already have columns
-- (migration 0006), this one doesn't.
alter table public.checkout_sessions add column coupon_snapshot jsonb not null default '{}';
