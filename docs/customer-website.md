# Customer Website

Implementation of the canonical roadmap's Phase 9, read against Ch.12
Part 2 (Customer Experience Architecture, §14-40), Ch.16 §71-90
(Customer API), Ch.6 (Customer Information Architecture), and the
relevant Ch.8 Commerce Engine domains — all read verbatim in full. Real
checkout (address/slot/payment persistence, Razorpay) is Phase 10's
scope per the canonical roadmap; this phase builds everything up to
"Proceed to checkout," which lands on an honest stub page rather than a
dead link or a faked flow.

## Schema gaps filled

Same pattern as every prior phase — Ch.16/Ch.12 name a resource, Ch.10
never gives it a table:

| Gap                                                                                      | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Wishlist (Ch.16 §79, Ch.12 §32)                                                          | New `wishlists` table (customer_id, product_id, unique pair) — own-row RLS.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Recipients (Ch.16 §74)                                                                   | New `recipients` table, optionally FK'd to a saved `customer_addresses` row.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Recently Viewed (Ch.16 §82, Ch.12 §33)                                                   | New `recently_viewed` table — "Logged In: Database" per Ch.12 §33; guests are pure client-side, never hit this table at all.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Customer Status/Tags/Internal Notes (Ch.16 §98, used by Phase 8's admin Customer Module) | Added to `customers` — `marketing_opt_in` already existed, these three didn't.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **No `customers` row on signup**                                                         | The `on_auth_user_created` trigger (Phase 4) provisions `public.users` but deliberately doesn't reach into the commerce-domain `customers` table — and `customers`' RLS has no INSERT policy for `authenticated` at all (service_role/admin only, by design). Every account API in this phase depends on a `customers` row existing, so this was a real, load-bearing gap: fixed with `ensureCustomerProfile()`, called from both `/auth/callback` (email verify, OAuth) and `signInWithPassword` (covers a session that already existed before this fix shipped). |

## Cart has no database table — by design, for now

Ch.10's schema has no `cart` table anywhere; the first server-persisted
cart-like structure is `checkout_sessions.cart_snapshot` (Ch.8 §91),
created when checkout actually starts (Phase 10). Until then, the cart
is guest-first client state (`lib/cart-context.tsx`, React Context +
`localStorage`) — the identical storage pattern Ch.12 §33 already
specifies for Recently Viewed. 6 unit tests cover the merge/remove/
subtotal logic via `renderHook`.

## Customer-facing API layer

Every `/api/v1/account/**` route uses the **session-bound** Supabase
client (`createSupabaseServerClient()`), not the service-role admin
client Phase 8's admin routes use — RLS enforces "customers may only
access their own resources" (Ch.16 §71/§89) as real defense-in-depth,
not just an application-layer check. A new `getCurrentCustomer()`
helper resolves the caller's `customers.id` through their own session
(so `customers_select_own`'s RLS is what actually decides whether a row
comes back).

Built: Profile (GET/PATCH), Addresses (full CRUD), Recipients (full
CRUD), Wishlist (GET/POST/DELETE-by-productId), Recently Viewed
(GET/POST), Reviews (GET/POST with verified-purchase enforcement/
PATCH/DELETE), Order History + Detail + Tracking (GET, owner-only),
Preferences (GET/PATCH, split between real `customers` columns and a
`metadata.preferences` jsonb bag for the three fields Ch.10 has no
column for), Sessions (GET/revoke-one/revoke-all).

**Explicitly deferred, matching the handbook's own "Future" labels**:
Saved Cart API (Ch.16 §81: "Future"), Loyalty API (Ch.16 §88: "Version 1
returns 501"), Privacy/GDPR export-and-delete (Ch.16 §86: "Future GDPR
workflows"), a real-time Customer Notifications inbox (Ch.16 §87 itself
says "Future: Real-time notifications," and the existing `notifications`
table is an outbound delivery log — not owned per-customer — so bolting
a feed onto it would be the wrong ownership model, not a shortcut worth
taking).

**A real edge case caught while writing the Reviews API**: Ch.16 §80
says "Edit within configurable period," but the RLS policy Phase 3 wrote
(`reviews_update_own_pending`) already encodes something more precise —
editable only while `status = 'pending'`, not a fixed day count. Used
that as the actual rule instead of inventing an arbitrary window; a
moderated review's UPDATE affects 0 rows, surfaced as a 409 rather than
a silent no-op.

## Public browsing API

`GET /api/v1/products/[slug]` (published only), `GET /api/v1/categories`,
`GET /api/v1/search` — uses the GIN full-text index on
`products(name, description)` (migration 0005) via `.textSearch()`
rather than `ILIKE`, matching Ch.12 §18's "<200ms" instant-search intent.

## Storefront pages

New `app/(storefront)` route group (its own header/nav/footer,
independent of `/admin`'s shell): Homepage (Ch.12 §15 — hero, categories,
featured products, an active offer banner, approved reviews; Instagram
Gallery/FAQ sections deferred, no Instagram API decision made and FAQ
lives on its own page), Shop (`/shop`, `/shop/[category]`, sortable),
Product Detail (`/product/[slug]`, server-rendered for SEO per Ch.12
§22, breadcrumb/gallery/price/add-to-cart/buy-now/description/reviews),
Search, Cart, Login/Signup (the first real UI for Phase 4's
`signInWithPassword`/`signUpWithPassword` server actions — they existed
since Phase 4 with no form calling them until now), Account (`/account`
overview, `/account/orders` + detail with Phase 7's `OrderTimeline` fed
real `order_events` timestamps, `/account/addresses`, `/account/wishlist`),
Blog (`/blog`, `/blog/[slug]`, block-based content matching
`blog_blocks`' "editor upgrades never need a schema change" design),
6 static pages (About/Contact/Privacy/Terms/FAQ/Delivery Policy) reading
from `static_pages`/`faqs`, and a global on-brand 404.

Product sort deliberately does **not** offer "Price" as an option even
though Ch.12 §20 lists it as a filter: price lives in the joined
`product_prices` table, which the query builder used here can't order
by directly — rather than silently mislabeling a `created_at` sort as
"Price," that option waits for a price-aware query (a view or RPC) to
back it honestly.

## Verified, not just written

```
pnpm format      ✓
pnpm lint        ✓
pnpm typecheck   ✓ (9/9 packages)
pnpm test        ✓ (packages/commerce: 25 tests, apps/web: 76 tests)
pnpm build       ✓ (76 total routes)
```

Plus 33 migrations applied clean against disposable Docker Postgres, and
the new wishlist RLS re-verified with real inserted rows (a customer
sees their own wishlist row; a different `auth.uid()` sees zero).

**Live browser verification, further than Phase 8 could go**: this dev
environment still has no live Supabase instance, but unlike Phase 8's
admin routes (which hang waiting on `requireAdmin()`'s auth check),
every public storefront page degrades gracefully — every Supabase query
result here is consumed through a `?? []`/`?? null` fallback, so an
unreachable database renders correct empty states instead of a blank
screen. That made a real live walkthrough possible: homepage, shop,
product listing, cart (empty and interactive — added an item, watched
the header badge and drawer update), search, login/signup forms, and
the `/admin` → `/login` redirect (confirming Phase 8's auth gate and
this phase's now-real login page both work together) — all screenshotted
at both 1440px and 375px, zero console errors beyond one benign Next.js
font-preload warning unrelated to this phase's code.

## What's deferred (by design)

- Real checkout (address selection, delivery slot, payment) — Phase 10.
  `/checkout` is a stub page, same pattern as Phase 8's AI Workspace stub.
- Recipients/Preferences have no dedicated UI yet — the API exists;
  wiring them into the checkout flow is more natural once Phase 10 builds
  the page that actually consumes them.
- Media/file upload for reviews ("Photos (Future)" per Ch.12 §34).
- Category filter facets beyond category/sort (flower type, occasion,
  color, delivery time) — Ch.12 §20 lists them, but they need a
  product-attribute data model (tags/variants) this phase didn't build.
- A submittable Contact form — needs an outbound email integration
  (Resend) not yet wired into this build; the page renders published
  CMS contact info instead of a form that would silently go nowhere.
