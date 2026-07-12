-- categories.image_url — homepage "Shop by category" cards (CategoryCard
-- component already supported an `image` prop, nothing ever populated it,
-- so every card rendered as a plain color block with no picture).

alter table public.categories
  add column if not exists image_url text;
