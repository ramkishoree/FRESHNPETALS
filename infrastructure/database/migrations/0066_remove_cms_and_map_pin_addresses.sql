-- Owner's explicit call during the storefront revamp: the site is now
-- exactly Products / Orders / My Account. The blog and every CMS-backed
-- content page were removed from the storefront AND from the admin panel,
-- so the tables behind them have no reader and no writer left.
--
-- Two independent changes ship together because they're one product
-- decision: strip the CMS, and make saved addresses actually usable at
-- checkout.

-- ---------------------------------------------------------------------
-- 1. Drop the blog + static page CMS.
-- ---------------------------------------------------------------------
-- `cascade` here drops each table's own RLS policies (0016), indexes and
-- touch_row triggers (0009) along with it. blog_blocks and
-- blog_category_links reference blogs via `on delete cascade` FKs, so
-- ordering is handled, but they're listed explicitly rather than relying
-- on the cascade to make the intent readable.
--
-- IRREVERSIBLE: this deletes blog content and the About/Contact/Privacy/
-- Terms/Delivery-Policy page bodies. The two pages that survive
-- (/privacy, /terms) had their copy moved into the app source first —
-- see apps/web/app/(storefront)/{privacy,terms}/page.tsx.
drop table if exists public.blog_category_links cascade;
drop table if exists public.blog_blocks cascade;
drop table if exists public.blog_categories cascade;
drop table if exists public.blogs cascade;
drop table if exists public.static_pages cascade;

-- blog_status (0002) existed only for blogs.status. content_status is NOT
-- dropped — landing_pages and homepage_sections still use it.
drop type if exists blog_status;

-- The permission string has nothing left to authorise (0017 seeded it;
-- packages/identity/src/roles.ts no longer lists it).
delete from public.role_permissions
where permission_id in (select id from public.permissions where name = 'blogs.publish');
delete from public.permissions where name = 'blogs.publish';

-- ---------------------------------------------------------------------
-- 2. Make saved addresses match how checkout actually captures an address.
-- ---------------------------------------------------------------------
-- Checkout has been map-pin-based since the delivery-fee-by-distance
-- work: the customer drops a pin, and Google returns one formatted
-- address string plus lat/lng — there is no separately-typed city or
-- postal code to store. customer_addresses (0005) predates that and
-- required both, which is precisely why a saved address could never be
-- replayed into checkout.
--
-- Widening rather than dropping: existing rows keep their city/postal
-- code, and an admin-entered address that does have them still stores
-- them. New pin-based rows simply leave them null.
alter table public.customer_addresses alter column city drop not null;
alter table public.customer_addresses alter column postal_code drop not null;

-- address_line_1 now holds the Google-formatted address for pin-based
-- rows. Kept NOT NULL — every address, typed or pinned, has one.
comment on column public.customer_addresses.address_line_1 is
  'Google-formatted address string for map-pin addresses; street line for legacy/typed addresses.';
comment on column public.customer_addresses.latitude is
  'Delivery pin latitude. Required for an address to be selectable at checkout.';
comment on column public.customer_addresses.longitude is
  'Delivery pin longitude. Required for an address to be selectable at checkout.';
