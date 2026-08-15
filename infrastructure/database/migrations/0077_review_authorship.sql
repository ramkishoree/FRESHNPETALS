-- Let a reviewer change or withdraw what they wrote, and drop the
-- "verified purchase" badge.
--
-- The badge is gone at the owner's call. Since migration 0076 anyone can
-- leave a review without an account, and a badge that most genuine
-- customers will never carry — because most of them review from the
-- product page, not from an order — does not distinguish trustworthy
-- reviews from untrustworthy ones. It only makes the unbadged majority
-- look suspect. The column is dropped rather than left unread, so no
-- future query can resurrect a claim the site no longer stands behind.
alter table public.reviews drop column if exists verified_purchase;

-- A public reviewer has no account, so there is nothing to scope
-- ownership by. On submission the server mints a random token, returns
-- it once, and keeps only its SHA-256 here — the same shape as an API
-- key. The browser keeps the token; presenting it is what proves
-- authorship of that one review.
--
-- Storing the hash rather than the token means a leak of this table
-- still does not let anyone edit a stranger's review. Null for reviews
-- written by a signed-in customer, whose own id already proves it.
alter table public.reviews add column if not exists edit_token_hash text;

comment on column public.reviews.edit_token_hash is
  'SHA-256 of the edit token handed to an anonymous reviewer''s browser. Null when customer_id already establishes authorship.';

-- Never selected by the storefront, but a stray `select *` from an
-- authenticated context should not hand it out either.
revoke select (edit_token_hash) on public.reviews from anon, authenticated;
