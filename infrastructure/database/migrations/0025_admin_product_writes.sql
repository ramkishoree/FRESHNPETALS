-- Ch.11 §8's atomicity rule (see packages/core/src/repository.ts and
-- migration 0020's claim_next_job precedent): a write spanning more than
-- one table must be one Postgres function call, not sequential PostgREST
-- requests. Two admin product writes cross tables:
--   - creating a product also creates its product_prices row (§24: price
--     intentionally lives outside `products`).
--   - changing a price must also append to product_price_history (Ch.9
--     "Price Versioning" — no trigger does this automatically, so the
--     write path is the only place it can happen).

create or replace function public.admin_create_product(
  p_sku text,
  p_slug text,
  p_name text,
  p_description text,
  p_category_id uuid,
  p_base_price numeric,
  p_featured_image text,
  p_actor_id uuid,
  p_short_description text default null,
  p_collection_id uuid default null,
  p_sale_price numeric default null,
  p_seo_title text default null,
  p_meta_description text default null,
  p_focus_keyword text default null,
  p_additional_images jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_product_id uuid;
begin
  insert into public.products (
    sku, slug, name, short_description, description, category_id, collection_id,
    seo_title, meta_description, featured_image, created_by, updated_by, metadata
  ) values (
    p_sku, p_slug, p_name, p_short_description, p_description, p_category_id, p_collection_id,
    p_seo_title, p_meta_description, p_featured_image, p_actor_id, p_actor_id,
    jsonb_build_object('focusKeyword', p_focus_keyword, 'additionalImages', p_additional_images)
  )
  returning id into v_product_id;

  insert into public.product_prices (product_id, base_price, sale_price, created_by, updated_by)
  values (v_product_id, p_base_price, p_sale_price, p_actor_id, p_actor_id);

  insert into public.product_price_history (product_id, old_base_price, new_base_price, old_sale_price, new_sale_price, reason, changed_by)
  values (v_product_id, null, p_base_price, null, p_sale_price, 'Initial price on product creation.', p_actor_id);

  return v_product_id;
end;
$$;

comment on function public.admin_create_product is
  'Atomically creates a product + its price row + the initial price-history entry (Ch.8 §19, Ch.9 Price Versioning). Admin API only.';

revoke all on function public.admin_create_product from public, anon, authenticated;
grant execute on function public.admin_create_product to service_role;

create or replace function public.admin_update_product_price(
  p_product_id uuid,
  p_base_price numeric,
  p_sale_price numeric,
  p_actor_id uuid,
  p_reason text default null
)
returns void
language plpgsql
as $$
declare
  v_old_base numeric;
  v_old_sale numeric;
begin
  select base_price, sale_price into v_old_base, v_old_sale
  from public.product_prices
  where product_id = p_product_id
  for update;

  if not found then
    raise exception 'No price row for product %', p_product_id;
  end if;

  update public.product_prices
  set base_price = p_base_price, sale_price = p_sale_price, updated_by = p_actor_id
  where product_id = p_product_id;

  insert into public.product_price_history (product_id, old_base_price, new_base_price, old_sale_price, new_sale_price, reason, changed_by)
  values (p_product_id, v_old_base, p_base_price, v_old_sale, p_sale_price, p_reason, p_actor_id);
end;
$$;

comment on function public.admin_update_product_price is
  'Atomically updates product_prices and appends to product_price_history (Ch.9 Price Versioning) in one transaction. Admin API only.';

revoke all on function public.admin_update_product_price from public, anon, authenticated;
grant execute on function public.admin_update_product_price to service_role;
