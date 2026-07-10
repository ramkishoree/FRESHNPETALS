-- Ch.8 §20: "SKU — Immutable after publication." The state machine (§16)
-- allows Published -> Archived -> Draft, so `status = 'published'` alone
-- can't answer "has this product ever been published" once it's cycled
-- back to draft — a plain boolean, set once and never cleared, can.
alter table public.products add column ever_published boolean not null default false;
