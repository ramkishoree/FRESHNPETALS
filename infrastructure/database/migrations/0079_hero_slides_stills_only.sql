-- The hero band is photographs throughout.
--
-- 0078 made slot 1 a video slot. The owner's call after seeing it live
-- is that all four slots are stills, so this corrects the descriptions
-- 0078 left behind. Comments only — no data, no constraints, no columns
-- change, and applying it is cosmetic rather than required.
--
-- `media_type` and its check constraint deliberately still permit
-- 'video'. Narrowing the constraint would buy nothing: the admin API is
-- the only writer and it now refuses anything that is not an image, and
-- leaving the column as it is means restoring video later is a code
-- change rather than another migration against a live table. The
-- storefront asks for `media_type = 'image'` explicitly, so a row left
-- over from the video era is skipped rather than rendered.

comment on table public.hero_slides is
  'Up to four homepage hero slides, one per slot, all of them photographs. Managed from /admin/hero — no deploy needed to change them.';

comment on column public.hero_slides.media_type is
  'Kind of media in this slot. Only ''image'' is written now; ''video'' remains permitted so restoring video would not need a migration. The storefront filters on this rather than trusting it.';
