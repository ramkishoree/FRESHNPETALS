# Admin Dashboard + CMS

Implementation of the canonical roadmap's Phase 8, read against Ch.6
(Administrator Information Architecture), Ch.12 §41-65 (Admin Dashboard
Architecture), Ch.8 (Commerce Engine business rules), and Ch.16 §91-114
(Administrator API) — all read verbatim in full, not the Phase 0 summary.
AI Workspace/Automation Center/Telegram Assistant get a stub page each
(the pipeline behind them shipped in Phase 6; the eleven employee personas
that would populate them are Phase 11's scope, per your canonical roadmap).

## Schema gaps filled (same pattern as Phase 3/6)

Six gaps, each because a Ch.16 API section demanded something Ch.10's
7-part schema never defined a column or table for:

| Gap                                                                 | Fix                                                                                                                                                                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audit Log (Ch.16 §111, Ch.8 §117)                                   | Extended `event_store` — already the platform's immutable append-only backbone — with `actor_id`/`actor_ip`/`user_agent`/`severity`/`service`, instead of forking a parallel `admin_audit_log` table. |
| System Settings (Ch.16 §112)                                        | New `system_settings` table: key/category/value(jsonb)/`requires_owner`. RLS: admin-read, owner-write-for-critical-only (both DB-level RLS _and_ an app-level 403, defense in depth).                 |
| `delivery_groups`/`delivery_slots` missing universal columns        | Added `created_by`/`updated_by`/`deleted_at` — every other operational-config table in the same migration (`outlets`) has them; this looks like a 0006 oversight, not a second deliberate exemption.  |
| `announcements`/`static_pages`/`media_library` missing `deleted_at` | Added (plus `updated_at` on `media_library`) — Ch.16 §104/105 both specify DELETE endpoints Ch.10's schema had no soft-delete column to back.                                                         |
| Product SKU immutability (Ch.8 §20)                                 | `products.ever_published` boolean, set once, never cleared — `status = 'published'` alone can't answer "has this ever been published" once Archived → Draft cycles back (Ch.8 §16 draws that edge).   |
| `customers` missing Status/Tags/Internal Notes (Ch.16 §98)          | Added `status`/`tags`/`internal_notes` — `marketing_opt_in` already covered "Marketing Preferences", the other three didn't exist anywhere.                                                           |

Migrations 0023-0032, each independently applied and verified against a
disposable Docker Postgres before being trusted.

## Atomic writes (4 new Postgres functions)

Same rule as Phase 5's `claim_next_job`: a write spanning more than one
table is one function call, never sequential PostgREST requests.

- `admin_create_product` — `products` + `product_prices` + initial
  `product_price_history` row, one transaction.
- `admin_update_product_price` — price change + history append.
- `admin_adjust_inventory` — `inventory.physical_quantity` + the
  explaining `inventory_transactions` row (Ch.8 §45: "no inventory
  changes occur silently").
- `admin_update_order_status` — `orders.status` + the explaining
  `order_events` row (Ch.8 §105: "every transition generates an audit
  log").
- `admin_set_user_roles` — atomic delete-then-insert on `user_roles`, so
  a failed second call never leaves a user with zero roles.

All five hand-verified against real inserted data in Docker Postgres, not
just typechecked — including the negative case (over-damaging inventory
past zero correctly raises the `chk_inventory_available_non_negative`
CHECK constraint as a defense-in-depth backstop below the application
layer's own pre-flight check).

## Tier A vs Tier B

**Tier A** — Products, Inventory, Orders — get real `packages/commerce`
domain logic because the handbook specifies actual state machines and
validation rules for them:

- **Products**: Ch.8 §20 validation (name/slug/description/image-count/
  price rules) as a pure `validateAdminProductInput()` that checks
  whichever fields are present (serves both full-create and partial-
  update); Ch.8 §16 state machine (`canTransitionProductStatus`); SKU
  immutability once `ever_published`. 16 unit tests.
- **Inventory**: Ch.8 §45's manual-adjustment subset
  (`stock_added`/`damage`/`correction` — `reservation`/`sale`/`refund`
  are order-lifecycle-driven, Phase 10, never an admin dropdown option);
  sign validation (damage can only decrease, stock-added can only
  increase); reason required for damage. 5 unit tests.
- **Orders**: Ch.8 §105 state machine, exactly the edges the diagram
  draws (no invented "cancel from anywhere" convenience edges). 4 unit
  tests.

**Tier B** — Categories, Collections, Outlets, Delivery Slots, Coupons,
Offers, Announcements, Blogs, CMS Pages, Media, Reviews — share one
generic `AdminCrudRepository` + `createAdminCrudCollectionRoute`/
`createAdminCrudItemRoute` factory (`server/repositories/
admin-crud-repository.ts`, `server/http/admin-crud-route.ts`). These
resources have no business rules beyond "an administrator changed this
row, and it's audited" — a dozen near-identical hand-written repository
classes would be the premature complexity here, not the shared factory.
Reviews is the one exception even within Tier B: moderation-only (no
POST — customers create reviews in Phase 9), using `moderated_by`/
`moderated_at` instead of the generic `updated_by`.

Every write (Tier A or B) is audited via `recordAuditEvent()` — one
helper, called from every route, writing to `event_store` through the
service-role client (the table's RLS only grants `authenticated` a
SELECT policy, so audit rows aren't fabricatable by the actor they
describe).

## Admin UI

`app/admin/**`, gated by `proxy.ts` (Phase 4) plus a `requireAdmin()`
re-check in `app/admin/layout.tsx` (defense in depth, same discipline as
RLS not trusting the layer above it). Shell: `AdminShell` (sidebar +
topbar + command palette), sidebar collapses into a `Sheet` drawer below
`lg` (Ch.12 §61), command palette on Ctrl/Cmd+K (Ch.12 §60) navigating
the same nav tree.

- **Dashboard** (`/admin`): Ch.12 §44 homepage widgets — today's revenue/
  orders, active customers, pending deliveries, inventory alerts, recent
  activity (real `event_store` query) — reads Supabase directly (Server
  Component) rather than round-tripping through its own `/api/v1/admin/
dashboard` HTTP endpoint, which exists for other consumers (a future
  Telegram assistant, Phase 11) not for this page to call itself over the
  network.
- **Products**: list + `/new` + `/[id]` edit, a shared `ProductForm`,
  `ProductStatusControl` offering only the transitions
  `canTransitionProductStatus` allows.
- **Inventory**: table + an adjustment dialog (transaction type, signed
  quantity, reason).
- **Orders**: list + `/[id]` detail rendering Phase 7's `OrderTimeline`
  component fed real timestamps from `order_events`, plus a status/notes
  control offering only valid transitions.
- **11 Tier B resources**: one generic `AdminResourcePage` client
  component (list + create/edit dialog generated from a field config) —
  the UI-side mirror of the backend's CRUD factory.
- **Settings**: grouped by category, inline edit, Owner-only badge on
  critical keys.
- **Audit log**: read-only, severity filter.
- **Users & roles**: role reassignment (calls `admin_set_user_roles`),
  deactivate.
- **AI Workspace**: stub `EmptyState` explaining what's live (Phase 6)
  and what's Phase 11.

## A real bug caught during visual QA

Every Tier B page's "Add {X}" button and dialog title derived the
singular form by stripping a trailing `s` — `"Categories".replace(/s$/,
'')` produces `"Categorie"`, not `"Category"`. Caught by actually
rendering the shell in a browser (not just typecheck/lint/test, which
have no opinion on English grammar) via a temporary, now-deleted preview
route. Fixed by making `singularLabel` an explicit required prop on
`AdminResourcePage` instead of a derived guess, set correctly at all 10
call sites.

## Verified, not just written

```
pnpm format      ✓
pnpm lint        ✓
pnpm typecheck   ✓ (9/9 packages)
pnpm test        ✓ (packages/commerce: 25 tests, apps/web: 70 tests)
pnpm build       ✓ (24 admin API routes + 20 admin UI pages)
```

32 migrations applied clean against a disposable Docker Postgres, RLS
re-verified with real inserted rows (administrator denied a
`requires_owner` setting write; owner succeeds; `anon` sees zero audit
rows), all 5 new RPCs exercised end-to-end with real data (not just
typechecked against their signatures).

**Honest limitation**: this dev environment has no live Supabase
instance (placeholder env vars only), so the authenticated `/admin/**`
route tree itself couldn't be walked end-to-end in a browser the way
Phase 7's component showcase was. What _was_ verified live: the
`proxy.ts` auth gate correctly redirects an unauthenticated request to
`/login` (which 404s cleanly — Phase 9 hasn't built it yet — with zero
console errors), and the admin shell/nav/forms render correctly and
on-brand via a temporary unauthenticated preview route (deleted after
use, per the same pattern Phase 7 used for its component showcase).
Full authenticated walkthroughs are Phase 12's job (system-wide E2E,
Playwright against a real staging Supabase project).

## What's deferred (by design)

- Media Library file uploads (drag-and-drop to Supabase Storage via a
  signed URL) — this phase registers/edits asset _metadata_; the actual
  upload widget lands with Phase 9, the first page that needs the full
  flow end-to-end.
- AI Workspace, Automation Center, Telegram Assistant real content —
  Phase 11's eleven agent personas.
- Analytics dashboard beyond the homepage widgets (Ch.12 §54's full
  date-range/comparison/CSV-export dashboard) — needs `analytics_events`
  shapes Phase 9's customer-facing pages will start actually producing.
- Delivery Slots admin UI takes a raw delivery-group UUID rather than a
  picker — no Delivery Groups management page exists yet to pick from.
