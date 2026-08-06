-- Flower colour, as a first-class product attribute.
--
-- Owner's reason, from handling real orders: product titles alone are
-- ambiguous when an alert arrives. "Classic Anniversary Bouquet" and
-- "Anniversary Deluxe Arrangement" are hard to tell apart at a glance
-- while packing, but "Red ×2" and "White ×6" are not. Colour is the
-- fastest disambiguator for a florist, so it belongs next to the name
-- everywhere a product appears — the shop, the product page, the admin
-- table, and above all the order alert.
--
-- Deliberately free text rather than an enum: florists' colour language
-- ("blush", "two-tone pink", "mixed") does not fit a fixed list, and a
-- constraint here would mean a migration every time a new variety is
-- stocked. Empty/absent simply means "not recorded" and renders nothing.

alter table public.products add column if not exists color text;

comment on column public.products.color is
  'Flower colour shown beside the name on the storefront and in order alerts. Free text (e.g. "Red", "White", "Mixed").';

-- Cheap to maintain, and the storefront filters/sorts by colour next.
create index if not exists idx_products_color on public.products (color) where color is not null;
