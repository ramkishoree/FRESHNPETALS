-- Google Business Profile linkage per outlet — owner has a real live
-- listing ("Fresh N Petals, Gomti Nagar, Lucknow") and wants its name,
-- cover photo, and reviews (capped at 5, Google's own API limit) shown
-- on the outlet picker, admin panel, and a homepage/product-page review
-- carousel, replacing the on-site review display entirely.
--
-- Reviews are cached here (not fetched live on every page view — that's
-- an unbounded, real-money API cost) and refreshed periodically by a
-- cron sweep. google_reviews jsonb shape: array of
-- {authorName, rating, text, relativeTime, profilePhotoUrl}, max 5.

alter table public.outlets
  add column if not exists google_place_id text,
  add column if not exists google_business_name text,
  add column if not exists google_cover_photo_url text,
  add column if not exists google_rating numeric(2, 1),
  add column if not exists google_rating_count integer,
  add column if not exists google_reviews jsonb not null default '[]',
  add column if not exists google_reviews_fetched_at timestamptz;

create index if not exists idx_outlets_google_place_id on public.outlets (google_place_id)
  where google_place_id is not null;
