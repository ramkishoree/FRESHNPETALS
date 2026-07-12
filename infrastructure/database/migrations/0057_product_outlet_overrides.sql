-- Owner's explicit ask: manage stock/price/sale price/photo per outlet
-- from inside the Products tab, instead of separate Inventory/Outlets
-- tabs. Stock is already per-outlet (the `inventory` table, migration
-- 0005). Price and image were global (`product_prices` is one row per
-- product, `products.featured_image`/`product_media` have no outlet
-- concept) — this adds an OPTIONAL per-outlet override on top of those
-- global defaults, rather than replacing them: every product still has
-- one real default price/image, and an outlet only needs a row here
-- when it genuinely differs ("SIMPLE MINIMAL EFFORT" — an admin managing
-- one outlet, or outlets with identical pricing, never has to touch this
-- table at all).
create table public.product_outlet_overrides (
  id uuid primary key default uuid_generate_v7(),
  product_id uuid not null references public.products (id) on delete cascade,
  outlet_id uuid not null references public.outlets (id) on delete cascade,
  base_price_override numeric(12, 2) check (base_price_override is null or base_price_override >= 0),
  sale_price_override numeric(12, 2) check (
    sale_price_override is null
    or (sale_price_override >= 0 and (base_price_override is null or sale_price_override <= base_price_override))
  ),
  featured_image_override text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, outlet_id)
);

create index idx_product_outlet_overrides_product on public.product_outlet_overrides (product_id);
create index idx_product_outlet_overrides_outlet on public.product_outlet_overrides (outlet_id);

create trigger trg_touch_row_no_version before update on public.product_outlet_overrides
  for each row execute function private.touch_row_no_version();

alter table public.product_outlet_overrides enable row level security;
alter table public.product_outlet_overrides force row level security;

create policy product_outlet_overrides_select_public on public.product_outlet_overrides
  for select to anon, authenticated using (true);
create policy product_outlet_overrides_admin_all on public.product_outlet_overrides
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
