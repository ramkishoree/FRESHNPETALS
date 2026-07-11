-- Ch.8 §73 Coupon Engine lists ~12 coupon types (percentage, fixed, free
-- delivery, free gift, category, product, first order, birthday,
-- referral (future), corporate, influencer, employee) but only 4 ever
-- existed. `discount_type` is genuinely a different axis from these —
-- it's the *mechanism* (percentage vs fixed vs free-delivery/gift), not
-- who's allowed to use the code. A "corporate" coupon can be a
-- percentage or a fixed amount off just as easily as a "general" one.
-- Rather than conflating the two into one enum, this adds a second,
-- orthogonal column for eligibility.

alter table public.coupons
  add column eligibility_type text not null default 'general'
    check (eligibility_type in ('general', 'first_order', 'birthday', 'corporate', 'influencer', 'employee'));

-- Birthday-eligibility coupons need something to check against. No UI
-- captures this yet (that's a separate account-settings feature) — the
-- column and the validation logic are real and ready for when it does;
-- until then every customer's date_of_birth is null, so a 'birthday'
-- coupon simply has no eligible customers, not a broken feature.
alter table public.customers add column date_of_birth date;
