-- RLS — Commerce Domain. Ch.10 §33: "Anonymous → Read Published Products
-- Only", "Customer → Own Orders/Addresses/Reviews/Wishlist", "Administrator
-- → Full Access".

-- categories: public catalog browsing; admin manages everything.
alter table public.categories enable row level security;
alter table public.categories force row level security;

create policy categories_select_public on public.categories
  for select to anon, authenticated
  using (is_active = true and deleted_at is null);

create policy categories_admin_all on public.categories
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- collections: same public-read shape as categories.
alter table public.collections enable row level security;
alter table public.collections force row level security;

create policy collections_select_public on public.collections
  for select to anon, authenticated
  using (deleted_at is null);

create policy collections_admin_all on public.collections
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- products: anonymous/customer see only published, visible, non-deleted
-- products (§33); admin sees every status (draft/pending review/etc).
alter table public.products enable row level security;
alter table public.products force row level security;

create policy products_select_published on public.products
  for select to anon, authenticated
  using (status = 'published' and visibility = true and deleted_at is null);

create policy products_admin_all on public.products
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- product_prices: not sensitive on its own (mirrors the product it prices);
-- public read, admin write. Pricing calculations are still always
-- recomputed server-side at checkout (Ch.9) — this table only backs display.
alter table public.product_prices enable row level security;
alter table public.product_prices force row level security;

create policy product_prices_select_public on public.product_prices
  for select to anon, authenticated
  using (true);

create policy product_prices_admin_all on public.product_prices
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- product_price_history: internal audit trail only.
alter table public.product_price_history enable row level security;
alter table public.product_price_history force row level security;
create policy product_price_history_admin_all on public.product_price_history
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- tags / product_tags: public read (browsing/filtering), admin write.
alter table public.tags enable row level security;
alter table public.tags force row level security;

create policy tags_select_public on public.tags
  for select to anon, authenticated
  using (true);

create policy tags_admin_all on public.tags
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

alter table public.product_tags enable row level security;
alter table public.product_tags force row level security;

create policy product_tags_select_public on public.product_tags
  for select to anon, authenticated
  using (true);

create policy product_tags_admin_all on public.product_tags
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- outlets: public read of active outlets (store locator); admin manages.
alter table public.outlets enable row level security;
alter table public.outlets force row level security;

create policy outlets_select_public on public.outlets
  for select to anon, authenticated
  using (is_active = true and deleted_at is null);

create policy outlets_admin_all on public.outlets
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- inventory: public read (stock/availability badges on the storefront);
-- writes are transactional and happen through the backend service role,
-- never a direct client mutation, so there is no client write policy.
alter table public.inventory enable row level security;
alter table public.inventory force row level security;

create policy inventory_select_public on public.inventory
  for select to anon, authenticated
  using (true);

create policy inventory_admin_all on public.inventory
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- inventory_transactions: internal audit log only.
alter table public.inventory_transactions enable row level security;
alter table public.inventory_transactions force row level security;
create policy inventory_transactions_admin_all on public.inventory_transactions
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- customers: a customer may read/update their own profile; admin sees all.
-- No anon access — guest checkout writes happen via the backend's
-- service_role, never a direct anon-key client mutation (see order/payment
-- RLS file header for the full rationale).
alter table public.customers enable row level security;
alter table public.customers force row level security;

create policy customers_select_own on public.customers
  for select to authenticated
  using (user_id = auth.uid());

create policy customers_update_own on public.customers
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy customers_admin_all on public.customers
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- customer_addresses: own addresses only.
alter table public.customer_addresses enable row level security;
alter table public.customer_addresses force row level security;

create policy customer_addresses_select_own on public.customer_addresses
  for select to authenticated
  using (customer_id = private.current_customer_id());

create policy customer_addresses_insert_own on public.customer_addresses
  for insert to authenticated
  with check (customer_id = private.current_customer_id());

create policy customer_addresses_update_own on public.customer_addresses
  for update to authenticated
  using (customer_id = private.current_customer_id())
  with check (customer_id = private.current_customer_id());

create policy customer_addresses_delete_own on public.customer_addresses
  for delete to authenticated
  using (customer_id = private.current_customer_id());

create policy customer_addresses_admin_all on public.customer_addresses
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- coupons: admin-only. Ch.8 §8.11 "Coupon validation always occurs on the
-- server" — codes are applied through a backend RPC, never browsed
-- client-side (avoids enumeration of valid codes).
alter table public.coupons enable row level security;
alter table public.coupons force row level security;
create policy coupons_admin_all on public.coupons
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- coupon_redemptions: a customer may see their own redemption history;
-- redemptions are recorded server-side during checkout, so there's no
-- client insert policy.
alter table public.coupon_redemptions enable row level security;
alter table public.coupon_redemptions force row level security;

create policy coupon_redemptions_select_own on public.coupon_redemptions
  for select to authenticated
  using (customer_id = private.current_customer_id());

create policy coupon_redemptions_admin_all on public.coupon_redemptions
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- offers: public read of active promotions (these are meant to be
-- advertised, unlike coupon codes); admin manages.
alter table public.offers enable row level security;
alter table public.offers force row level security;

create policy offers_select_public on public.offers
  for select to anon, authenticated
  using (active = true and deleted_at is null);

create policy offers_admin_all on public.offers
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- reviews: public reads approved reviews; a customer may write and read
-- their own (including pending) reviews; admin moderates everything.
alter table public.reviews enable row level security;
alter table public.reviews force row level security;

create policy reviews_select_approved on public.reviews
  for select to anon, authenticated
  using (status = 'approved' and deleted_at is null);

create policy reviews_select_own on public.reviews
  for select to authenticated
  using (customer_id = private.current_customer_id());

create policy reviews_insert_own on public.reviews
  for insert to authenticated
  with check (customer_id = private.current_customer_id());

create policy reviews_update_own_pending on public.reviews
  for update to authenticated
  using (customer_id = private.current_customer_id() and status = 'pending')
  with check (customer_id = private.current_customer_id());

create policy reviews_admin_all on public.reviews
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());
