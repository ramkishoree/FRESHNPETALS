-- One free-text note for the owner, instead of four boxes to fill in.
--
-- 0070 added flower_type, size_label, packaging and owner_note to make
-- order alerts identifiable. In use that turned out to be four fields to
-- fill for every listing, three of them guessing at categories a florist
-- doesn't think in. The owner's call: drop the rigid ones and keep a
-- single description written however they like.
--
-- Safe to drop: all three were added recently and were still empty on
-- every product (verified before writing this), so nothing is lost.
--
-- `owner_note` is renamed rather than replaced, so the column keeps its
-- identity and any future data survives.

alter table public.products drop column if exists flower_type;
alter table public.products drop column if exists size_label;
alter table public.products drop column if exists packaging;

alter table public.products rename column owner_note to owner_description;

comment on column public.products.owner_description is
  'Owner-only free text describing the arrangement — shown in the WhatsApp order alert so the owner knows what to make at a glance. Never shown to customers.';
