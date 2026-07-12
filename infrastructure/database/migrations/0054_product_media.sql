-- Multiple photos/videos per product — previously only featured_image
-- (a single text column) existed, so a product could show exactly one
-- picture anywhere on the site.

create table public.product_media (
  id uuid primary key default uuid_generate_v7(),
  product_id uuid not null references public.products (id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  url text not null,
  -- Video only: a poster frame extracted at conversion time, since
  -- <video> has no equivalent of next/image's automatic placeholder and
  -- browsers otherwise show a blank box until playback/scrub.
  thumbnail_url text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_product_media_product_id on public.product_media (product_id, position);

alter table public.product_media enable row level security;
alter table public.product_media force row level security;

create policy product_media_select_public on public.product_media
  for select to anon, authenticated using (true);
create policy product_media_admin_all on public.product_media
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
