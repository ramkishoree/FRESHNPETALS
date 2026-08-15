-- At most one outlet may supply the storefront's Google reviews.
--
-- Google's Places API returns a maximum of 5 reviews per place, so
-- mixing two outlets would show an arbitrary handful from each rather
-- than one shop's genuine record. The owner picks the one that speaks
-- for the brand.
--
-- Enforced with a partial unique index on a constant, which is the
-- standard way to say "at most one row where this is true". Doing it in
-- the database rather than the admin UI means no amount of double
-- clicking, stale tabs or direct API calls can produce two.
--
-- Callers must clear before setting (see the reviews-source route):
-- unique indexes are checked per row as a statement progresses, so
-- flipping one on before the other off would trip this even though the
-- final state is valid.

create unique index if not exists idx_outlets_single_reviews_source
  on public.outlets ((true))
  where show_google_reviews and deleted_at is null;
