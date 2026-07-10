-- Ch.10 §35 Soft Delete Policy is a platform-wide rule; Ch.16 §104/105
-- (Blog/CMS Management API) both specify DELETE endpoints. announcements,
-- static_pages and media_library shipped in 0009 without `deleted_at`,
-- unlike every other content table in the same migration (blogs,
-- landing_pages, hero_banners) — an oversight, not a second deliberate
-- exemption (that pattern is documented, e.g. 0006's file header for
-- orders/payments; nothing here says the same).

alter table public.announcements add column deleted_at timestamptz;
alter table public.static_pages add column deleted_at timestamptz;

alter table public.media_library
  add column updated_at timestamptz not null default now(),
  add column deleted_at timestamptz;

create trigger trg_touch_row_no_version before update on public.media_library
  for each row execute function private.touch_row_no_version();
