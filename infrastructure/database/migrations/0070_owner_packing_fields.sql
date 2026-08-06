-- Owner-only packing details, and a way to link an outlet Google hasn't
-- indexed yet.
--
-- 1. Packing details on products.
--
-- Colour (0069) helped identify a product in the order alert, but not
-- enough: "Anniversary Deluxe Arrangement (Red) ×2" still doesn't say
-- what to make. These four say it — the flower, the size, what it goes
-- in, and anything else the owner needs reminding of.
--
-- **Never customer-facing.** Unlike `color`, these are deliberately kept
-- out of the `Product` domain type and out of PRODUCT_SELECT_COLUMNS, so
-- no storefront query can return them even by mistake. Only the admin
-- editor and the order-alert path select them.
--
-- Free text for the same reason colour is: a florist's vocabulary for
-- size ("12 stems", "large", "18in") and wrapping ("hand-tie", "hat box")
-- doesn't fit an enum, and a constraint would mean a migration per new
-- variety.

alter table public.products add column if not exists flower_type text;
alter table public.products add column if not exists size_label text;
alter table public.products add column if not exists packaging text;
alter table public.products add column if not exists owner_note text;

comment on column public.products.flower_type is
  'Owner-only. Rose / Lily / Orchid / Mixed — independent of the product title. Shown in the WhatsApp order alert, never to customers.';
comment on column public.products.size_label is
  'Owner-only. Size or stem count, e.g. "12 stems", "Large". Shown in the order alert.';
comment on column public.products.packaging is
  'Owner-only. Box / basket / vase / hand-tie. Shown in the order alert.';
comment on column public.products.owner_note is
  'Owner-only free text, e.g. "use the tall glass vase, gold ribbon". Appended to the order alert line.';

-- 2. Linking an outlet before Google's Places API knows about it.
--
-- A new Google Business listing shows up in Search and Maps days-to-weeks
-- before the Places API indexes it, so Autocomplete genuinely cannot find
-- it and there is no place_id to store. This holds what the owner asked
-- for; `sweepGoogleReviews` retries resolving it and fills in
-- google_place_id the day Google catches up.

alter table public.outlets add column if not exists google_place_query text;

comment on column public.outlets.google_place_query is
  'Business name or Maps URL to keep retrying against Places Text Search while the listing is too new to be indexed. Cleared once google_place_id resolves.';
