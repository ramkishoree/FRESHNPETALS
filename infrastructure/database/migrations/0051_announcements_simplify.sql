-- Simplify announcements per owner feedback ("too complex, just Title,
-- Image, Button 1 tied to an offer, Button 2 = No"). Rather than dropping
-- the existing text-bar columns (background_color/text_color/button_url
-- etc — still valid for a future text-only banner use case, and dropping
-- columns is harder to walk back than leaving them unused), this adds
-- what's actually missing: a real image and a real link to an offer
-- instead of a hand-typed URL.

alter table public.announcements
  add column if not exists image_url text,
  add column if not exists offer_id uuid references public.offers (id);

create index if not exists idx_announcements_offer_id on public.announcements (offer_id);
