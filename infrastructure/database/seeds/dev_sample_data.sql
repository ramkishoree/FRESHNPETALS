-- Local/dev sample data only. Never run against staging or production.
-- Gives a freshly-migrated local database something real to render once
-- Phase 9 (Customer Website) exists.

insert into public.categories (slug, name, description, sort_order) values
  ('birthday', 'Birthday', 'Birthday bouquets and arrangements', 1),
  ('anniversary', 'Anniversary', 'Anniversary flowers', 2),
  ('roses', 'Roses', 'Rose bouquets', 3)
on conflict (slug) do nothing;

insert into public.outlets (name, slug, address, city, state, country, latitude, longitude, delivery_radius_km, phone, email)
values (
  'Fresh & Petals — Gomti Nagar',
  'gomti-nagar',
  '1 Vipin Khand, Gomti Nagar',
  'Lucknow',
  'Uttar Pradesh',
  'IN',
  26.8600,
  80.9990,
  12,
  '+91-9990000001',
  'gomtinagar@freshandpetals.example'
)
on conflict (slug) do nothing;

insert into public.products (sku, slug, name, short_description, description, category_id, status, visibility, featured_image)
select
  'FNP-ROSE-RED-12',
  'premium-red-rose-bouquet',
  'Premium Red Rose Bouquet',
  'A dozen hand-picked red roses, elegantly wrapped.',
  'A dozen hand-picked red roses, elegantly wrapped in premium paper with fresh greens. Same-day delivery available.',
  c.id,
  'published',
  true,
  '/images/products/premium-red-rose-bouquet.jpg'
from public.categories c where c.slug = 'roses'
on conflict (sku) do nothing;

insert into public.product_prices (product_id, base_price, sale_price)
select p.id, 1499.00, 1299.00
from public.products p where p.slug = 'premium-red-rose-bouquet'
on conflict (product_id) do nothing;

insert into public.inventory (product_id, outlet_id, physical_quantity, reserved_quantity, low_stock_threshold)
select p.id, o.id, 25, 0, 5
from public.products p, public.outlets o
where p.slug = 'premium-red-rose-bouquet' and o.slug = 'gomti-nagar'
on conflict (outlet_id, product_id) do nothing;
