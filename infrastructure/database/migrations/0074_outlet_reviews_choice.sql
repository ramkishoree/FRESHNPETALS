-- Choose which outlet's Google reviews appear on the storefront.
--
-- Prompted by a real incident: 0070 added google_place_query and had the
-- review sweep resolve it automatically via Places Text Search. The
-- Arjunganj outlet resolved to "New Fresh n Petals" — a *different*
-- business with 101 reviews — and those reviews went live on the site
-- as though they were ours.
--
-- Two separate mistakes, both fixed here and in the sweep:
--
-- 1. Automatic linking took the first text-search candidate as truth. A
--    name search cannot distinguish two florists with similar names, and
--    the cost of being wrong is publishing someone else's reputation as
--    your own. The sweep no longer links anything by itself.
--
-- 2. Every linked outlet's reviews were shown. With more than one shop
--    the owner needs to say which one speaks for the brand — a new
--    branch with no reviews should not dilute an established one.

alter table public.outlets
  add column if not exists show_google_reviews boolean not null default false;

comment on column public.outlets.show_google_reviews is
  'Whether this outlet''s Google reviews appear on the storefront. Off by default: a link must be confirmed correct before its reviews are shown publicly.';

-- The only outlet verified as genuinely ours keeps showing reviews.
update public.outlets
set show_google_reviews = true
where google_place_id is not null
  and deleted_at is null
  and name = 'Fresh N Petals - Gomti Nagar';
