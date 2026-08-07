-- Offers become a promotion the owner can write in plain words.
--
-- The admin form asked for offer_type, a priority number, and two raw
-- JSON blobs (conditions/reward). That is a pricing-engine control
-- panel, not something you fill in to run a Diwali offer — the owner
-- asked for a tagline, a heading, dates, and free-text conditions.
--
-- The pricing engine still exists and still works: `resolveActiveOffer`
-- keeps applying real percentage/fixed/BOGO offers. What changes is that
-- a promo written through the simple form is **display only** — it
-- advertises a coupon code rather than silently altering totals. That
-- separation matters: an owner writing marketing copy should not be able
-- to change what customers are charged by accident.

alter table public.offers add column if not exists tagline text;
alter table public.offers add column if not exists banner_heading text;
alter table public.offers add column if not exists conditions_text text;
alter table public.offers add column if not exists coupon_code text;
alter table public.offers
  add column if not exists display_only boolean not null default false;

comment on column public.offers.tagline is
  'Short line shown on the floating badge and as the poster headline, e.g. "Flat 20% off this Diwali".';
comment on column public.offers.banner_heading is
  'Heading for the site-wide banner. The banner itself shows only this, the coupon code and when it ends.';
comment on column public.offers.conditions_text is
  'Free-text terms shown on the poster. Deliberately unstructured — real offer terms do not fit a schema.';
comment on column public.offers.coupon_code is
  'The code customers type at checkout. A display-only offer advertises this rather than discounting by itself.';
comment on column public.offers.display_only is
  'True for promos written in the simplified admin form: advertised, never applied automatically by resolveActiveOffer.';

-- `offer_type` is NOT NULL with a CHECK, so a display-only promo needs a
-- value that means "this one does not compute anything".
alter table public.offers drop constraint if exists offers_offer_type_check;
alter table public.offers add constraint offers_offer_type_check
  check (offer_type = any (array['percentage','fixed','buy_x_get_y','free_gift','free_delivery','display']));
alter table public.offers alter column offer_type set default 'display';

-- Anything that already exists was created through the old engine-facing
-- form and must keep applying exactly as before.
update public.offers set display_only = false where display_only is null;
