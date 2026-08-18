-- Homepage hero slides, and a free-text product "type".
--
-- Two additive changes, deliberately in one file because they ship
-- together as one homepage/product-card revision.
--
-- ## Why `hero_slides` and not `hero_banners`
--
-- `public.hero_banners` already exists from migration 0009's CMS schema
-- (title/subtitle/button_text/button_url/desktop_image/mobile_image,
-- the last two NOT NULL). Nothing in the application has ever read it.
-- Reusing that name would mean dropping NOT NULLs and half the columns
-- of a live table for a feature that has nothing to do with it, so the
-- new feature gets its own table and the orphan is left exactly as it
-- is. Removing the orphan is a separate decision for a separate day.
--
-- ## Shape
--
-- Exactly four slots, addressed by number rather than by row identity:
-- the admin screen is four fixed cards ("Slot 1 — video", slots 2-4
-- images), not a list you can add to. `slot_order` is unique and range
-- checked, so the database itself guarantees there can never be a fifth
-- slot or two rows fighting over slot 2.

create table if not exists public.hero_slides (
  id uuid primary key default uuid_generate_v7(),
  slot_order integer not null unique check (slot_order between 1 and 4),
  media_type text not null check (media_type in ('video', 'image')),
  media_url text not null,
  -- Optional overlay line. Null means the slide shows the media alone,
  -- with no gradient scrim over it.
  caption_text text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.hero_slides is
  'Up to four homepage hero slides, one per slot. Slot 1 is the video slot; 2-4 are stills. Managed from /admin/hero — no deploy needed to change them.';
comment on column public.hero_slides.slot_order is
  'Which of the four fixed admin slots this row fills. Unique: a slot holds one slide or none.';
comment on column public.hero_slides.caption_text is
  'Optional overlay line, bottom-left over a dark gradient. Null renders the media with no scrim at all.';

create index if not exists idx_hero_slides_active on public.hero_slides (is_active, slot_order);

create trigger trg_touch_row_no_version before update on public.hero_slides
  for each row execute function private.touch_row_no_version();

-- Anyone may read a slide that is switched on; only an admin writes.
-- Same shape as announcements_select_enabled (0016) — the homepage is
-- served to signed-out visitors through the anon role.
create policy hero_slides_select_active on public.hero_slides
  for select to anon, authenticated using (is_active = true);
create policy hero_slides_admin_all on public.hero_slides
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
alter table public.hero_slides enable row level security;
alter table public.hero_slides force row level security;

-- ## products.type
--
-- A short free-text label printed above the product name on the card —
-- "Bouquet", "Gift hamper", "Standing arrangement". Free text and
-- nullable for the same reason `color` is (0069): a florist's own
-- vocabulary does not fit an enum, and a constraint here would mean a
-- migration every time a new format is stocked. Null/empty renders
-- nothing at all on the card, not a placeholder.

alter table public.products add column if not exists type text;

comment on column public.products.type is
  'Short free-text product format shown above the name on a listing card (e.g. "Bouquet", "Gift hamper"). Null means the card shows nothing there.';
