# Database Schema

Implementation of Handbook **Chapter 10 — Database Design** (Parts 1–7,
§1–167), re-read verbatim for this phase rather than relied on the Phase 0
summary — schema mistakes compound downstream, so this needed exact column
lists, not a paraphrase.

Migrations: `infrastructure/database/migrations/0001`–`0018` (numbered,
applied in order). Dev sample data: `infrastructure/database/seeds/`.

## How this was verified

No Supabase project exists yet for this build, so every migration was
applied against a disposable `pgvector/pgvector:pg17` Docker container with
a minimal shim reproducing Supabase's platform surface (`infrastructure/
database/test-shim/0000_supabase_shim.sql` — `auth.users`, `auth.uid()`/
`auth.jwt()`/`auth.role()`, and the `anon`/`authenticated`/`service_role`
roles). This is test-only scaffolding; a real Supabase project already
provides all of it — never run the shim against one.

Concretely tested, not just eyeballed:

- Full migration set (0001–0018 + seed) applies cleanly from a blank
  database, in order, with `ON_ERROR_STOP=1`.
- `uuid_generate_v7()` produces valid, monotonically-sortable UUIDs with
  correct RFC 9562 version/variant bits.
- `inventory.available_quantity` (generated column) computes correctly and
  its CHECK constraint rejects negative stock (reservation > physical).
- RLS: anonymous sees only `published` products, not `draft`; a customer
  reading `customer_addresses` sees only their own row, never another
  customer's; granting a user the `administrator` role via `user_roles`
  correctly unlocks full visibility through `private.is_admin()`.
- Every one of the 84 tables has `ENABLE ROW LEVEL SECURITY` **and**
  `FORCE ROW LEVEL SECURITY` (queried `pg_class.relrowsecurity`/
  `relforcerowsecurity` directly — 84/84).
- Materialized views **cannot** carry RLS policies (Postgres rejects it on
  `relkind = 'm'` — confirmed by trying it) and the blanket table grant
  from migration 0010 reaches them too (`GRANT ... ON ALL TABLES` includes
  matviews). Caught this by testing `mv_customer_lifetime_value` as `anon`
  before the fix — customer emails and lifetime value were fully readable.
  Fixed with an explicit `REVOKE` in 0018; re-verified `anon` now gets
  `permission denied` and `service_role` still reads fine.

## Canonical decisions applied (from Phase 0 / your approval)

- **RLS**: Ch.10 gives narrative rules only ("Administrator → Full Access",
  "Customer → Own Orders/Addresses/Reviews", "Anonymous → Published Products
  Only"). Every actual `CREATE POLICY` in migrations 0011–0016 was designed
  here, least-privilege, and is commented with its rationale inline.
- Administrator and Owner are treated identically for **data access** — the
  handbook never distinguishes them at the RLS level (both "get
  everything"). `private.is_admin()` returns true for either role. Phase 5+
  business logic may still gate Owner-only _features_ (e.g. Settings →
  Danger Zone) — that's an application-layer decision, not a database one.

## Gaps in Ch.10 filled here (documented, not silent)

Ch.10 names several entities as Commerce aggregate roots (§5, §12) and
they're used throughout Ch.8/Ch.9/Ch.16's business rules, but **none of
them get a physical schema anywhere in Ch.10's 167 sections**:

| Table                                     | Why it was needed                                                                                                                                                                                                                                                     | Informed by                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `coupons`, `coupon_redemptions`           | Ch.8 §8.11 coupon engine has no schema                                                                                                                                                                                                                                | Ch.8/Ch.9 business rules, Ch.16 Coupons API                |
| `offers`                                  | Ch.9's offer priority ladder (1–6) has no schema                                                                                                                                                                                                                      | Ch.9 pricing waterfall, Ch.16 Offers API                   |
| `reviews`                                 | Named in the ERD (§23) with zero columns                                                                                                                                                                                                                              | Ch.8 verified-purchase/moderation rules, Ch.16 Reviews API |
| `product_prices`, `product_price_history` | §24 explicitly says pricing is NOT stored on `products` ("Inventory is NOT stored here... Pricing snapshots are NOT stored here"), but no separate pricing table is ever defined either — the same pattern `inventory` uses for stock, just never completed for price | Ch.9 "Price Versioning" section                            |

Also filled, always flagged inline in the migration file with `-- inferred`:
`fulfillment_status`/`delivery_status`/`user_status`/`api_key_status`/
`job_status`/`notification_status`/`webhook_status`/`content_status` enum
value lists (the handbook names the column but not every value), and the
`sessions` table absorbing what §72 "Device Sessions" describes (browser/OS/
device/last-activity) since §72 is narrative-only with no column list of
its own — sessions already has every column §72 asks for.

## Design choices worth knowing about

- **`public.users` is a profile table, not the identity table.**
  `auth.users` (Supabase Auth) owns authentication per §79 ("password
  hashes never exist inside application tables"); `public.users.id`
  references it 1:1. A trigger (`handle_new_auth_user`) auto-provisions the
  profile row on signup.
- **`customers.user_id` is nullable.** Ch.8 mandates guest checkout ("never
  force registration"), but `orders.customer_id` is `NOT NULL` (§41). A
  guest gets a `customers` row without a `user_id` at checkout time; if
  they register later, `user_id` gets linked. This is the one thing that
  reconciles those two otherwise-contradictory requirements.
- **Order/payment/checkout/delivery/invoice writes are service_role-only.**
  No migration grants anon/authenticated INSERT or UPDATE anywhere in that
  domain. This isn't a limitation — it's the handbook's own principle
  ("Frontend success alone never creates an Order", §47; every checkout/
  payment step runs inside a backend transaction, §54) enforced at the
  database layer instead of only trusted at the application layer.
  Authenticated customers get read-only access to their own historical
  records. Guest order confirmation is returned directly by the backend API
  response at checkout time, not fetched later via a direct client query.
- **Coupon codes are admin-only readable**, not publicly listable — this
  matches Ch.8's "coupon validation always occurs on the server" and
  incidentally prevents code enumeration. Offers (promotions meant to be
  advertised) are public-read; coupons (codes meant to be entered, not
  browsed) are not.
- **`media_library` is admin-only.** Its column list mixes public assets
  (images) with internal documents (invoice PDFs, exports — §155). Rather
  than add a visibility flag the handbook never specifies, the storefront
  references plain CDN URL strings directly (`products.featured_image`,
  etc. — already public), and `media_library` the _table_ stays an
  internal admin asset-management index.
- **Immutable financial tables** (`orders`, `order_items`, `payments`,
  `refunds`, `invoices`, `order_events`) don't get `created_by`/`updated_by`/
  `deleted_at` from the §16 universal-columns rule — attribution lives in
  the append-only `order_events` timeline instead, which is the more
  correct audit trail for records the handbook says must never be deleted
  (§34) or overwritten (Principle 3). They keep `version` for optimistic
  concurrency on the status-transition columns, the one thing that
  legitimately mutates post-creation.
- **UUIDv7 is hand-implemented** (`uuid_generate_v7()`, migration 0001).
  Postgres has no native `uuidv7()` before v18; the function is a standard
  48-bit-timestamp + random-bits construction with version/variant bits set
  per RFC 9562, tested for correctness (see above).
- **Embeddings are `vector(1536)`** (OpenAI `text-embedding-3-small`
  dimension) as a v1 default — Ch.10 §102 specifies pgvector but not a
  dimension; revisit if Phase 6 picks a different embedding model.

## Deferred to later phases (not gaps — dependencies not ready yet)

- **RLS is designed and applied at the DB layer now; JWT custom claims are
  not wired yet.** `private.is_admin()`/`has_permission()` currently do a
  live join against `user_roles`/`roles`/`role_permissions` on every check
  rather than reading a JWT claim — correct and secure, just not the
  fastest possible path. Phase 4 (Auth) can add a Supabase Auth Hook to
  embed roles/permissions into the JWT and fast-path these functions
  without changing any policy's SQL.
- **Seven materialized views are intentionally not built yet**: Top Blogs,
  Most Viewed Pages, Best Landing Pages, SEO Scoreboard, Media Usage,
  Content Health, Homepage Performance, Order Funnel (Ch.10 §58/§166). Each
  depends on `analytics_events.event_name`/`page` value shapes the backend
  (Phase 5) hasn't defined yet — building the aggregation now would mean
  guessing an event taxonomy and likely rebuilding the view once real event
  names exist.
- **Materialized view refresh scheduling** (nightly/incremental, §37) is a
  Phase 5/13 operations concern (pg_cron or an app-scheduled job), not
  something a migration file creates.
