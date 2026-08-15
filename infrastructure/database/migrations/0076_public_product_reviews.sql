-- Reviews anyone can leave, with photos.
--
-- Until now a review required a delivered order and a signed-in
-- customer, so `customer_id` was NOT NULL. The owner wants the form open
-- on every product page: a name and a star rating, a comment if they
-- feel like it, and up to three photos of what actually arrived.
--
-- `customer_id` becomes nullable and `author_name` carries who wrote it.
-- The check keeps every row attributable — one or the other must be
-- present, so an anonymous row can never lose its name and become
-- unattributed.
--
-- `verified_purchase` stays meaningful: it is only ever true for a review
-- tied to a real order, so the badge still distinguishes a customer we
-- can prove bought the product from a passer-by.

alter table public.reviews alter column customer_id drop not null;

alter table public.reviews add column if not exists author_name text;

-- Public URLs of re-encoded WebP images, in display order. JSONB rather
-- than a child table: they are written once with the review, never
-- queried independently, and never more than three.
alter table public.reviews add column if not exists images jsonb not null default '[]'::jsonb;

comment on column public.reviews.author_name is
  'Display name typed by a public reviewer. Null for reviews written by a signed-in customer, whose name comes from the customer row.';
comment on column public.reviews.images is
  'Array of public image URLs uploaded with the review. Server re-encodes every upload to WebP, which strips EXIF/GPS.';

alter table public.reviews drop constraint if exists reviews_attributable;
alter table public.reviews add constraint reviews_attributable
  check (customer_id is not null or nullif(btrim(author_name), '') is not null);

-- Anonymous reviewers have no session, so the storefront reads them
-- through the anon role. Approved reviews were already publicly
-- readable; this only widens it to rows with no customer_id.
drop policy if exists reviews_select_approved on public.reviews;
create policy reviews_select_approved on public.reviews
  for select using (status = 'approved' and deleted_at is null);
