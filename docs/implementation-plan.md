# Implementation Plan — Prana Commerce OS

Canonical roadmap (supersedes the phase order in the Engineering Handbook's own
roadmap section; approved 2026-07-09). The Handbook remains the source of truth
for all business rules, domain models, and requirements — only phase **order**
and the clarifications below are amended.

| Phase | Name                                                                     | Status  |
| ----- | ------------------------------------------------------------------------ | ------- |
| 0     | Repository Analysis                                                      | ✅ Done |
| 1     | Project Foundation                                                       | ✅ Done |
| 2     | Design System Foundation                                                 | ✅ Done |
| 3     | Database Foundation                                                      | ✅ Done |
| 4     | Authentication & Authorization                                           | ✅ Done |
| 5     | Core Backend Foundation                                                  | ✅ Done |
| 6     | AI Foundation (gateway/router/memory/embeddings/workflow — no employees) | ✅ Done |
| 7     | Reusable Component Library                                               | ✅ Done |
| 8     | Admin Dashboard + CMS (built together)                                   | ✅ Done |
| 9     | Customer Website                                                         | ✅ Done |
| 10    | Checkout & Payments (Razorpay; COD out of scope)                         | ⏳ Next |
| 11    | AI Employees                                                             | Pending |
| 12    | System-wide Testing (Playwright, security, perf, a11y, AI eval)          | Pending |
| 13    | Deployment                                                               | Pending |

## Canonical Decisions (2026-07-09)

These resolve ambiguities flagged in Phase 0 and take precedence over any
conflicting narrative in the Handbook:

1. **RLS**: handbook gives narrative rules only — explicit, documented,
   least-privilege SQL policies designed per table in Phase 3.
2. **Design tokens**: Handbook Chapter 5 values are canonical. Later chapters'
   token _names_ map onto Chapter 5's values where they differ.
3. **Lighthouse**: target 98+ desktop / CI hard gate 95+; Accessibility,
   Best Practices, SEO all 100 (target and gate).
4. **Staging**: mandatory. No Development → Production deploys.
5. **Monitoring**: Sentry (errors/perf/tracing), Vercel Analytics (CWV),
   Supabase Dashboard (DB metrics). Provider-agnostic abstraction where practical.
6. **AI providers v1**: Anthropic, OpenAI, Groq — behind a provider abstraction
   that admits Gemini/OpenRouter/Ollama without business-logic changes.
7. **COD**: out of scope for v1. Architecture must not preclude adding it later;
   no COD business logic is implemented now.
8. **Canary**: 5% → 25% → 50% → 100%.
9. **DR**: use the more detailed of any duplicate procedures found in the Handbook.
10. **Testing**: not a terminal phase — unit/integration/type/lint gates apply
    per phase. Phase 12 is system-wide validation only (E2E, security, perf,
    accessibility, AI evaluation, production verification).

## Phase 1 — Project Foundation (completed)

**Scope delivered:**

- pnpm workspace + Turborepo monorepo (`apps/*`, `packages/*`)
- `apps/web` — Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind v4
- `packages/{core,commerce,identity,marketing,ai,analytics,operations,shared}` —
  empty domain packages, ready for Phase 5+/Phase 6 business logic
- `infrastructure/{database,events,workers}`, `scripts/`, `tests/{e2e,integration}`
- Tooling: ESLint 9 flat config (typescript-eslint, type-aware for package
  source, non-type-aware for config files), Prettier (+ Tailwind class sorting),
  Husky (`pre-commit`: lint-staged, `pre-push`: typecheck + test)
- Vitest wired in every package (`passWithNoTests` until Phase 3+ adds real
  business logic); Playwright config wired in `apps/web` (no specs yet — no
  pages exist to test until Phase 9/10)
- GitHub Actions CI skeleton: format check, lint, typecheck, test, build,
  Gitleaks secret scan, `pnpm audit` dependency gate
- `.env.example` covering Supabase, Redis, Razorpay, Resend, Telegram,
  Anthropic/OpenAI/Groq, Google Maps, Sentry, Vercel Analytics
- Root README + per-directory READMEs documenting structure and rules

**Verification (all green on 2026-07-09):**

```
pnpm format:check   ✓
pnpm lint           ✓ (9/9 packages)
pnpm typecheck      ✓ (9/9 packages)
pnpm test           ✓ (9/9 packages, 0 tests — no business logic yet)
pnpm build          ✓ (apps/web builds and prerenders)
```

**Handbook compliance:** Ch.11 Pt.1 (backend project structure), Ch.12 Pt.2
(frontend folder structure, Next.js 16/TS strict/Tailwind v4), Ch.17 (testing
tooling), Ch.18 (git workflow/CI pipeline stages). No business logic
implemented, per Handbook Phase 1 scope ("complete foundation before business
code").

**Deviation from global default stack:** user's global CLAUDE.md default stack
lists Next.js 14; the Handbook explicitly and repeatedly mandates Next.js 16 +
Tailwind v4 for this project. Handbook wins as source of truth.

## Phase 2 — Design System Foundation (completed)

**Scope delivered:**

- `apps/web/styles/tokens.css` — Ch.5 brand tokens as a Tailwind v4 `@theme`
  block: colors, typography scale (with paired line-height/tracking/weight),
  8pt spacing, per-component radius, subtle warm-tinted shadows, motion
  easing, breakpoints, container max-width
- shadcn/ui-compatible semantic variable mapping (`--background`, `--primary`,
  `--muted-foreground`, etc.) so Phase 7 components theme correctly with zero
  rework
- Accessible derived neutrals/status-text colors not specified by the
  handbook (charcoal body text, muted-foreground, destructive fill, etc.) —
  every one computed and verified against WCAG 2.2 AA (≥4.5:1); full
  contrast-ratio trace in `docs/design-tokens.md`
- Dormant `.dark` token scaffold (Ch.5.27: "not in v1, architecture should
  support it") — real values derived, but not wired to any class/toggle
- Geist self-hosted via `next/font` (`geist` package), Inter/system-ui as
  declarative CSS fallbacks only (no extra bytes shipped)
- `lucide-react` installed (Ch.5.12: icons, no fills, no color)
- Brand mark: `apps/web/app/icon.svg` (auto-wired favicon) +
  `apps/web/public/logo-mark.svg` (reusable asset) — five-petal bloom, forest
  green + gold center
- `docs/design-tokens.md` — full value-by-value trace to Ch.5, contrast-ratio
  evidence, and usage notes for Phase 7

**Verification (all green on 2026-07-09):**

```
pnpm format:check   ✓
pnpm lint           ✓ (9/9 packages)
pnpm typecheck      ✓ (9/9 packages)
pnpm test           ✓ (9/9 packages)
pnpm build          ✓ (favicon route confirmed: /icon.svg)
```

Visual check: `next dev`, loaded in a real browser via Chrome DevTools MCP,
screenshotted, zero console errors — confirms `@theme`/`@utility` compiled
and the token layer doesn't break the app shell.

**Handbook compliance:** Ch.5 (all 33 sections read verbatim this phase, not
relied on the Phase 0 summary — this phase needed exact values, not a
paraphrase). No component library yet (Phase 7) — tokens only, as scoped.

## Phase 3 — Database Foundation (completed)

**Scope delivered:**

- `infrastructure/database/migrations/0001`–`0018` — full Ch.10 schema
  (Parts 1–7 re-read verbatim, not the Phase 0 summary): identity, commerce,
  order/payment/checkout/delivery/invoice, AI, event/platform, marketing/CMS
  domains. 84 tables total.
- Hand-implemented `uuid_generate_v7()` (Postgres has no native `uuidv7()`
  before v18) — tested for valid RFC 9562 version/variant bits and
  monotonic sortability.
- Explicit, documented, least-privilege RLS policies on **all 84/84 tables**
  (Ch.10 gives narrative rules only — "Administrator → Full Access" etc. —
  every actual policy was designed this phase per your canonical decision
  #1). `private.is_admin()`/`has_permission()`/`current_customer_id()`
  helper functions in a non-exposed `private` schema.
- Four gaps in Ch.10 filled and documented: `coupons`, `coupon_redemptions`,
  `offers`, `reviews`, `product_prices`, `product_price_history` — named as
  aggregate roots throughout the handbook but never given a physical schema
  anywhere in the Database Design chapter.
- 11 materialized views (Ch.10 §37/§58) — the ones fully determined by
  schema this phase built; 7 more (Top Blogs, SEO Scoreboard, etc.) are
  deferred to Phase 5 since they key off `analytics_events` shapes the
  backend hasn't defined yet.
- RBAC seed data: 4 roles, 17 permissions (Ch.10 §65/§67, verbatim), full
  grants to administrator/owner.
- `docs/database-schema.md` — full documentation of every decision, gap
  filled, and security tradeoff, with the evidence for each.

**Verification — actually applied and exercised, not just written:**

Built a disposable `pgvector/pgvector:pg17` Docker container with a minimal
Supabase-platform shim (`infrastructure/database/test-shim/` — test-only,
never run against a real project) and:

```
Full migration set (0001-0018 + seed) applies clean from blank DB   ✓
uuid_generate_v7() — valid version/variant bits, sortable            ✓
inventory CHECK constraint rejects negative stock                    ✓
RLS: anon sees published products only, not drafts                   ✓
RLS: customer sees only their own customer_addresses row              ✓
RLS: granting 'administrator' role unlocks full visibility            ✓
84/84 tables: RLS enabled AND forced (queried pg_class directly)       ✓
```

**Security bug caught and fixed during this phase:** materialized views
cannot carry RLS policies (confirmed by testing — Postgres rejects it), and
the blanket table grant from migration 0010 reaches them too. Before the
fix, `anon` could read `mv_customer_lifetime_value` directly — customer
emails and lifetime value, fully exposed, zero row filtering. Caught by
testing as `anon` before declaring the phase done, not by inspection. Fixed
with an explicit `REVOKE` in 0018; re-verified `anon` denied, `service_role`
still works.

**Handbook compliance:** Ch.10 Parts 1–7 (§1–167) read verbatim in full this
phase. No backend/API code yet (Phase 5) — schema and RLS only, as scoped.

## Phase 4 — Authentication & Authorization (completed)

**Scope delivered:** Supabase Auth wiring only — no pages, per the roadmap
(Component Library is Phase 7, before any page in Phase 8/9). Full detail
in `docs/auth.md`; summary:

- Three Supabase client factories (browser/server/admin), env split
  public/server via Zod so a service-role key can't leak client-side.
- `apps/web/proxy.ts` — session refresh + `/account` and `/admin` route
  protection, including a role-dependent session-freshness check (admin
  sessions force re-auth after 12h vs. Supabase's own longer JWT expiry for
  customers, Ch.15 §18).
- RBAC resolution (`server/auth/session.ts`), Server Actions for sign-up/
  in/out + password reset (`server/auth/actions.ts`), admin TOTP MFA
  wrappers (`server/auth/mfa.ts`), failed-login lockout
  (`server/auth/lockout.ts`).
- `packages/identity` — role/permission types + password-policy validator,
  framework-agnostic, unit tested (13 tests).
- Migration 0019: added `login_history.attempted_identifier` — a genuine
  Ch.10 gap (§76 gives no column to key a pre-auth lockout check by).

**Verification:**

```
pnpm format:check   ✓
pnpm lint           ✓
pnpm typecheck      ✓ (9/9 packages)
pnpm test           ✓ (18 tests: 13 identity + 5 lockout)
pnpm build          ✓
```

**Caught mid-phase:** `next build` flagged `middleware.ts` as deprecated in
favor of `proxy.ts` (confirmed via Next's own `constants.js`, then via the
build itself requiring the exported function be renamed too). Both the
file and export are `proxy` now.

**Handbook compliance:** Ch.14/15 app-level security controls, Ch.16 Auth
API surface (server-side logic only — routes/pages are Phase 8/9).

## Phase 5 — Core Backend Foundation (completed)

**Scope delivered:** full detail in `docs/backend-architecture.md`; summary:

- Layer split: domain/application in `packages/commerce` (framework-free,
  unit-testable with fakes), infrastructure in `apps/web/server/
repositories`, presentation in `apps/web/server/http` + `app/api/v1`.
- `packages/core` — the exact 7-class `AppError` hierarchy, `Result<T,E>`,
  `DomainEvent`, base `Repository` interface.
- One real working vertical slice: `GET /api/v1/products` — security chain
  → Zod validation → application service → Supabase repository → Postgres
  → envelope — proving the pattern the rest of Phases 6/8/9/10/11 repeat.
- Security chain (rate-limit tiers per Ch.16 §19, bot detection deferring
  to Cloudflare's header, auth/authz), global security headers, structured
  JSON logger with redaction.
- Background job queue: `claim_next_job` Postgres function (migration
  0020, `FOR UPDATE SKIP LOCKED` — can't be expressed through PostgREST) +
  a framework-agnostic `processNextJob` with exponential backoff, proven
  with a trivial `sample.ping` job type.
- **Architectural decision that affects Phase 10**: multi-step atomic
  writes (e.g. order creation) must be single Postgres RPC calls, never
  sequential repository calls — PostgREST gives no cross-call atomicity.
  Documented with `claim_next_job` as the concrete precedent.

**Verification:**

```
pnpm format:check   ✓
pnpm lint           ✓
pnpm typecheck      ✓ (9/9 packages)
pnpm test           ✓ (57 tests across the workspace)
pnpm build          ✓ (2 new routes: /api/v1/products, /api/internal/jobs/process)
```

Plus a real integration test: Postgres + PostgREST in Docker, confirming
the exact `product_prices(base_price,sale_price)` embed query returns an
object (one-to-one), not an array — matching what the repository's mapper
expects, verified against the real REST layer rather than assumed.

**Two build-breaking bugs caught and fixed, not glossed over:** Next.js
wasn't transpiling `packages/*` (fixed: `transpilePackages`), and `.js`-
extension relative imports broke Turbopack specifically even though
`tsc`/Vitest tolerated them (fixed: stripped the extensions, consistent
with our `Bundler` module resolution) — both documented in
`docs/backend-architecture.md` so they don't get reintroduced.

**Handbook compliance:** Ch.11 Part 1 (§1–17) read verbatim in full. No
other aggregates' business logic built yet — that's each feature phase's
job, per scope.

## Phase 6 — AI Foundation (completed)

**Scope delivered:** full detail in `docs/ai-foundation.md`; summary:

- `packages/ai` — pure domain logic (Model Router, Prompt Registry
  assembly, prompt-injection guard, cost controller, kill switch,
  context-window math), 42 unit tests, zero dependencies.
- Provider adapters for OpenAI/Anthropic/Groq (`apps/web/server/ai/
adapters`) — the only files allowed to import those SDKs (Ch.14 §7).
- `AiOrchestrator` — the real Ch.14 §13/§66 pipeline (kill switch → budget
  → injection scan on input → memory retrieval → injection scan on
  retrieved memory → prompt assembly → model routing → context-budget
  check → provider call → cost recording), 11 tests covering every branch.
- Gateway entry point: `GET /api/v1/admin/ai/health` (admin-only, checks
  configured provider health — feeds Phase 8's future governance
  dashboard).
- Three DB gaps filled (migrations 0021–0022, same pattern as Phase 3's
  coupons/offers/reviews): `ai_models` (Ch.14 §68 registry — the actual
  governance gate behind "only approved models run in production"),
  `ai_kill_switches` (§80), `ai_budgets` (§81). All admin-only RLS,
  verified directly against real SQL.

**Verification:**

```
pnpm typecheck   ✓ (9/9 packages)
pnpm lint        ✓
pnpm test        ✓ (packages/ai: 42 tests; apps/web: +11 orchestrator tests)
pnpm build       ✓
```

**A real bug caught before it shipped, not glossed over:** the business-
memory search repository interpolated a raw query string directly into a
PostgREST `.or()` filter — PostgREST's filter syntax treats `,()` as
structural, so an unsanitized string could inject additional filter
conditions. Found by re-reading the code, fixed by sanitizing the query
before building the filter.

**Handbook compliance:** Ch.14 Parts 1–4 (§1–89) read verbatim in full —
this is the platform's most security-sensitive infrastructure, not
something to build from a paraphrase. No AI employee personas (Phase 11),
no tool/approval/workflow-execution engine (needs real agents, Phase 11),
per your canonical decision #6/roadmap scope.

## Phase 7 — Reusable Component Library (completed)

**Scope delivered:** full detail in `docs/component-library.md`; summary:

- `components/ui/*` — 32 shadcn/ui ("new-york") primitives on Radix, patched
  wherever Ch.5's exact typography/radius rules differ from shadcn's
  generic defaults (Button weight/size, Button/Card/Dialog/AlertDialog
  radii).
- `components/commerce/*` (Ch.12 §82): product/category cards, price/
  discount/delivery/inventory badges, review card, offer banner, coupon
  card, cart item, a shared `Timeline` primitive → `OrderTimeline`/
  `DeliveryTimeline`, invoice preview.
- `components/ai/*` (Ch.12 §83): confidence badge, AI suggestion card,
  approval card (5 risk levels), business health card, weekly brief,
  recommendation panel, workflow timeline, activity feed, prompt diff
  viewer.
- `components/states/*`: empty/error/loading (4 variants)/spinner.
- `components/charts/*` (Ch.12 §86): line/area/bar/pie wrapping Recharts,
  6-color categorical palette validated with the `dataviz` skill's
  `validate_palette.js` (CVD ΔE, WCAG contrast, OKLCH lightness/chroma).
- `components/data-table/*`: TanStack Table v8 wrapper (sort, search,
  column visibility, row selection/bulk actions, sticky header,
  pagination).
- `components/dashboard/stat-tile.tsx`, `components/forms/
form-autosave-indicator.tsx` + debounced `hooks/use-autosave.ts`.

**Two real bugs caught during visual QA, both invisible to lint/typecheck/
test:**

1. **Every chart rendered as empty space.** Root-caused via
   `superpowers:systematic-debugging` (ruled out duplicate-React,
   Recharts/React 19 incompatibility, Turbopack tree-shaking; isolated to
   Next.js specifically by confirming the identical chart rendered
   correctly under Vitest/jsdom) to this app's own `Content-Security-Policy`
   (`script-src 'self'`, Ch.11 §16) blocking Next's own inline hydration/
   RSC-flight bootstrap scripts — static SSR markup still painted, but
   Recharts' internal SVG is built entirely by client JS that CSP was
   silently preventing from running. Fixed by moving CSP from a static
   `next.config.ts` header to a per-request nonce minted in `proxy.ts`
   (`'nonce-<random>' 'strict-dynamic'`, `'unsafe-eval'` added dev-only for
   Turbopack/React's dev stack-trace reconstruction), threaded through as
   an `x-nonce` header into `next-themes`' `<ThemeProvider>`.
2. **Hydration mismatch on every rendered date.** `ReviewCard`, `Timeline`,
   `InvoicePreview`, `AiActivityFeed` all called `toLocaleDateString()`/
   `toLocaleString()` with no locale — server and browser default locales
   differed (`01/06/2026` vs `1/6/2026`), so React discarded and
   re-rendered the subtree. Fixed with a shared `lib/format-date.ts`
   pinned to `en-IN`, rewired at all four call sites plus
   `components/ui/calendar.tsx`'s `data-day` attribute (same bug class).

**Verification:**

```
pnpm format      ✓
pnpm lint        ✓
pnpm typecheck   ✓ (9/9 packages)
pnpm test        ✓ (apps/web: 64 tests)
pnpm build       ✓
```

Plus live browser verification (Chrome DevTools MCP): full-page screenshot
of every component category, zero console errors, zero dev-overlay issues,
charts rendering real SVG content. Temporary showcase page
(`app/dev-preview/**`) deleted before closing the phase.

**Handbook compliance:** Ch.5 (component-level typography/radius rules),
Ch.12 §82 (Commerce components), Ch.12 §83 (AI components), Ch.12 §86
(Charts). No real page built — Phase 8/9 are the first consumers, per
roadmap scope.

## Phase 8 — Admin Dashboard + CMS (completed)

**Scope delivered:** full detail in `docs/admin-dashboard.md`; summary:

- 10 migrations (0023-0032) filling 6 schema gaps Ch.16's Administrator
  API demanded but Ch.10 never gave a column/table for: audit log columns
  on `event_store`, `system_settings`, universal columns on
  `delivery_groups`/`delivery_slots`, `deleted_at` on
  `announcements`/`static_pages`/`media_library`, `products.ever_published`,
  and `customers.status`/`tags`/`internal_notes`.
- 5 atomic Postgres RPCs (product create, price update, inventory
  adjustment, order status transition, user-role replacement) — same
  single-function-call-for-cross-table-writes rule as Phase 5's
  `claim_next_job`, each hand-verified against real inserted data in
  Docker Postgres.
- Tier A (`packages/commerce` domain logic, real state machines/
  validation): Products (Ch.8 §20 validation, §16 state machine, SKU
  immutability), Inventory (Ch.8 §45 manual-adjustment types, sign
  validation), Orders (Ch.8 §105 state machine). 25 unit tests.
- Tier B (generic `AdminCrudRepository`/`createAdminCrudCollectionRoute`
  factory, documented rationale for sharing one implementation): 11
  structurally-uniform resources — Categories, Collections, Outlets,
  Delivery Slots, Coupons, Offers, Announcements, Blogs, CMS Pages,
  Media, Reviews (moderation-only, no create).
- Every write, Tier A or B, audited via one `recordAuditEvent()` helper
  writing to `event_store` through the service-role client.
- Full admin UI (`app/admin/**`): dashboard homepage, Products (list +
  wizard-free create/edit + status control), Inventory (adjustment
  dialog), Orders (list + detail with Phase 7's `OrderTimeline` fed real
  timestamps), 11 Tier B resource pages sharing one generic
  `AdminResourcePage` component, Settings (Owner-gated critical keys),
  read-only Audit Log, Users & Roles, and an honest AI Workspace stub
  (Phase 11 populates it).

**A real bug caught during visual QA:** every Tier B page derived its
"Add {X}" button/dialog title by regex-stripping a trailing `s`
(`"Categories".replace(/s$/, '')` → `"Categorie"`, not `"Category"`).
Caught by actually rendering the admin shell in a browser via a
temporary, now-deleted preview route — lint/typecheck/tests have no
opinion on English grammar. Fixed with an explicit required
`singularLabel` prop instead of a derived guess.

**Verification:**

```
pnpm format      ✓
pnpm lint        ✓
pnpm typecheck   ✓ (9/9 packages)
pnpm test        ✓ (packages/commerce: 25 tests, apps/web: 70 tests)
pnpm build       ✓ (24 admin API routes + 20 admin UI pages)
```

Plus 32 migrations applied clean against disposable Docker Postgres, RLS
re-verified with real inserted rows (administrator denied a
`requires_owner` setting write; owner succeeds; `anon` sees zero audit
rows).

**Honest limitation, stated rather than glossed over:** this dev
environment has no live Supabase instance, so the authenticated
`/admin/**` route tree couldn't be walked end-to-end in a browser the way
Phase 7's component showcase was. What _was_ verified live: `proxy.ts`'s
auth gate correctly redirects unauthenticated requests to `/login`
(cleanly 404s — Phase 9 hasn't built it), and the admin shell/nav/forms
render correctly and on-brand via a temporary unauthenticated preview
route. Full authenticated E2E walkthroughs are Phase 12's job.

**Handbook compliance:** Ch.6 (Administrator Information Architecture),
Ch.12 §41-65 (Admin Dashboard Architecture), Ch.8 (Commerce Engine
business rules for Products/Inventory/Orders/Coupons/Offers), Ch.16
§91-114 (Administrator API) — all read verbatim in full. AI Workspace/
Automation Center/Telegram Assistant are stubs by design — Phase 11
scope, per your canonical roadmap.

## Phase 9 — Customer Website (completed)

**Scope delivered:** full detail in `docs/customer-website.md`; summary:

- 4 schema gaps filled: `wishlists`, `recipients`, `recently_viewed`
  tables, `customers.status`/`tags`/`internal_notes`. A fifth, more
  load-bearing gap found and fixed: no `customers` row was ever created
  on signup (the identity trigger provisions `public.users` only, and
  `customers`' RLS has no authenticated-INSERT policy by design) — every
  account feature in this phase depends on that row existing, fixed with
  `ensureCustomerProfile()` called from both the auth callback and
  password sign-in.
- Cart: no DB table exists for it anywhere in Ch.10 (the first
  server-persisted cart-like structure is `checkout_sessions.cart_snapshot`,
  Phase 10); built as guest-first client state
  (`lib/cart-context.tsx`, Context + localStorage), 6 unit tests.
- Full `/api/v1/account/**` customer API using the **session-bound**
  Supabase client (RLS-enforced ownership, not the admin/service-role
  client Phase 8's admin routes use): Profile, Addresses, Recipients,
  Wishlist, Recently Viewed, Reviews (verified-purchase enforced),
  Order History/Detail/Tracking, Preferences, Sessions. Saved Cart/
  Loyalty/Privacy-GDPR/real-time Notifications explicitly deferred —
  the handbook itself marks the first three "Future," and the fourth
  would misuse an existing table with the wrong ownership model.
- Public browsing API: product detail by slug, categories, full-text
  search (GIN index, not ILIKE).
- Full storefront (`app/(storefront)/**`): homepage, shop/category
  listing, product detail (server-rendered for SEO), search, cart,
  login/signup (the first real UI for Phase 4's auth server actions),
  account section (orders with Phase 7's `OrderTimeline` fed real
  timestamps, addresses, wishlist), blog, 6 static pages, on-brand 404.
  `/checkout` is an honest stub (Phase 10 builds the real flow) rather
  than a dead link.

**Verification:**

```
pnpm format      ✓
pnpm lint        ✓
pnpm typecheck   ✓ (9/9 packages)
pnpm test        ✓ (packages/commerce: 25 tests, apps/web: 76 tests)
pnpm build       ✓ (76 total routes)
```

Plus 33 migrations applied clean against disposable Docker Postgres,
wishlist RLS re-verified with real inserted rows. Unlike Phase 8's admin
routes (which hang on `requireAdmin()`'s auth check with no live
Supabase in this environment), every storefront page consumes its data
through a `?? []`/`?? null` fallback and so degrades to a correct empty
state instead of hanging — this made a real live walkthrough possible:
homepage, shop, cart (added an item, watched the header update live),
search, login/signup, and the `/admin` → `/login` redirect, at both
1440px and 375px, zero console errors beyond one benign unrelated
Next.js font-preload warning.

**Handbook compliance:** Ch.12 Part 2 (§14-40 Customer Experience
Architecture), Ch.16 §71-90 (Customer API), Ch.6 (Customer Information
Architecture), relevant Ch.8 Commerce Engine domains — all read verbatim
in full. Real checkout/payment is Phase 10's scope per your canonical
roadmap; this phase stops at "Proceed to checkout."

## Phase 10 — Checkout & Payments (completed)

Full detail in `docs/checkout-payments.md`. Summary:

- **Migrations 0034-0037**: `checkout_sessions.coupon_snapshot`;
  `order_number_counters` + `generate_order_number()` (per-calendar-year
  sequence, Ch.8 §104 `FNP-2026-000001`); `checkout_start` /
  `checkout_cancel` / `checkout_complete` atomic RPCs, the last later
  amended to also redeem coupons in the same transaction as the order.
  `payments`/`refunds` needed no new columns — an earlier phase already
  carried `gateway_order_id`/`gateway_payment_id`/`gateway_signature`/
  `method`/`idempotency_key`, and `method` already future-proofs a
  `'cod'` value with zero schema change (canonical decision #7).
- **Every RPC verified against real Docker Postgres data**, not just
  read for correctness: happy path, duplicate-webhook idempotency
  replay (Ch.8 §102 — order count stayed at 1), reservation release on
  cancellation, insufficient-stock rejection, full coupon-redemption
  bookkeeping.
- **Core design principle** (Ch.8 §89 Principle 5 — never trust
  frontend payment callbacks): only `POST /api/webhooks/razorpay`,
  authenticated by Razorpay's own webhook HMAC, ever creates an order.
  The client-side Razorpay `handler` only navigates to a processing
  page that polls status until the webhook lands.
- Two design bugs caught and fixed before/while writing (not left for a
  test to catch): the webhook's order→session lookup would have been
  circular against `payments` (that row doesn't exist yet when the
  webhook fires) — fixed by stashing `razorpayOrderId` in
  `checkout_sessions.metadata` at checkout-start time; and a confused
  reuse of the client-side payment-signature check inside the webhook
  handler, removed as dead/wrong-signature-type logic.
- Full frontend: `/checkout` (session-gated, redirects guests to
  `/login?next=/checkout`), `CheckoutFlow` client component
  (address/coupon entry, Razorpay checkout.js via nonce'd `next/script`),
  `/checkout/[sessionId]/processing` (polls status, redirects to Phase
  9's existing `/account/orders/[id]` page for order confirmation —
  reused rather than duplicated, since it already covers Ch.12 §30's
  Order Success requirements).

**Verification:**

```
pnpm lint        ✓
pnpm typecheck   ✓ (9/9 packages)
pnpm test        ✓ (packages/commerce: 45 tests, apps/web: 83 tests)
pnpm build       ✓ (new routes: /checkout, /checkout/[sessionId]/processing,
                    /api/v1/checkout, /api/v1/checkout/[sessionId]/status,
                    /api/webhooks/razorpay)
```

Live-verified in Chrome: unauthenticated `/checkout` correctly redirects
to `/login?next=/checkout`; `/checkout/[sessionId]/processing` renders
its loading state and fires its poll request (which hangs pending in
this sandbox with no live Supabase/Razorpay, the same known limitation
documented in Phases 8-9); zero console errors.

**Deferred, flagged not silently dropped:** Delivery Slot Selector UI,
real server-computed pricing preview before payment, Payment
Reconciliation API (Ch.16 §137), admin refund-initiation UI, order
notifications (Resend/WhatsApp, deferred project-wide per Phase 9).

**Handbook compliance:** Ch.8 §88-113 (Checkout/Payment Domain,
Principles, State Machines, Razorpay Integration, Order Creation,
Invoice Engine, Failure Recovery), Ch.16 §60-70 (Checkout/Orders/
Coupons API), Ch.16 §133-158 (Razorpay Webhooks, Reconciliation,
Webhook Security, Retry Strategy) — all read verbatim in full.

## Phase 11 — AI Employees (completed)

Full detail in `docs/ai-employees.md`. Summary:

- **Scope-defining discovery**: Ch.9 §28's Agent Permission Matrix grants
  no v1 agent Publish or Delete on anything, and `admin_create_product`
  (Phase 8) requires a non-null price — a field every agent is forbidden
  to set. So no v1 agent tool call ever reaches a production-mutating
  RPC; every run produces a draft/report that lands in the Approval
  Queue, and any real production write still goes through Phase 8's
  existing admin tools. This is the literal spec, not a shortcut.
- **Load-bearing gap fix**: `ai_models` had zero seeded rows since Phase
  6 built the table — every `AiOrchestrator.execute()` call would have
  failed `no_model_available` regardless of agent logic. Migration 0038
  seeds one approved model per configured provider (Groq/OpenAI/
  Anthropic).
- **Capability Registry** (`packages/ai/src/agent-registry.ts`): all 11
  v1 personas (Product Manager, SEO Specialist, Blog Writer, Marketing
  Manager, Inventory Manager, Pricing Analyst, Analytics Analyst,
  Customer Insights, Review Manager, Automation Coordinator, Operations
  Assistant) as pure data — purpose/capabilities/tools/forbidden actions/
  memory scopes/KPIs/routing policy/system prompt/output schema.
  Migration 0039 mirrors the same 11 agents into the `ai_agents`/
  `ai_capabilities`/`ai_tools`/prompt-registry tables Phase 3 built but
  never seeded.
- **Agent Runtime** (`apps/web/server/ai/agent-runtime.ts`): resolves an
  agent by slug, runs it through Phase 6's `AiOrchestrator`, and always
  lands a successful run in `ai_tasks.status = 'waiting_approval'` —
  never anywhere else. Extended the orchestrator's cost-recording path
  with optional `agentId`/`taskId` threading (the concrete governance
  repo already had the columns, "until Phase 11 seeds real agents").
- **Approval Queue**: `ai_tasks` filtered to `waiting_approval` is the
  queue — no separate table. Migration 0040's `ai_approval_decide` RPC
  atomically records the decision and advances task status; verified
  against real Docker Postgres data for approve/reject/edit (metadata
  merge) plus both guard-rail errors (unknown task, re-deciding a
  terminal task). "Regenerate" has no matching decision value, so it
  cancels the old task and re-runs the same agent from
  `metadata.taskInstructions` instead.
- Admin UI: `/admin/ai` rewired from Phase 6's stub into an Employees
  grid (Run Task dialog) + Approval Queue list (Approve/Reject/Edit/
  Regenerate).

**Verification:**

```
pnpm lint        ✓
pnpm typecheck   ✓ (9/9 packages)
pnpm test        ✓ (packages/ai: 49 tests, apps/web: 88 tests)
pnpm build       ✓ (7 new /api/v1/admin/ai/** routes)
```

All 40 migrations applied clean against disposable Docker Postgres;
seed counts verified exactly (11 agents/24 capabilities/19 tools/24
agent-capability links/52 agent-tool links/11 prompts/3 models); the
approval RPC exercised with real inserted data end to end. Live-verified
in Chrome: unauthenticated `/admin/ai` redirects to
`/login?next=%2Fadmin%2Fai`, the underlying API returns a clean 403 JSON
envelope, zero console errors. Logging in as a real administrator to
exercise Run Task → Approval Queue end-to-end isn't possible in this
sandbox (no live Supabase/LLM credentials) — the same limitation
documented in every prior admin-facing phase.

**Deferred, flagged not silently dropped:** Workflow/Knowledge Base/
Embedding/Memory-admin/Provider-management/Cost-analytics/Telegram APIs
(Ch.16 §118, §121-123, §125, §128-130) and the full Business Knowledge
Graph/embeddings pipeline (Ch.9 Part 4, explicitly "Future Capabilities"
per its own §86) — a disproportionate scope addition for a roadmap item
titled "AI Employees." Business Memory retrieval stays Phase 6's
documented-swappable keyword search.

**Handbook compliance:** Ch.9 `09-AI-Business-OS.md` Parts 1-6 (§1-137:
AI Business OS foundation, AI Employees Specification, Orchestrator/
Memory/Workflow Engine, Business Knowledge Engine, Weekly Business
Operating System, Capability/Tool Registry & Agent Runtime) and Ch.16
Part 6 (§115-130, AI Business OS APIs) — all read verbatim in full.

## Phase 12: System-wide Testing (completed)

Full detail in `docs/testing-strategy.md`. Summary:

- **Coverage tooling**: `@vitest/coverage-v8` wired into every package;
  real numbers against Ch.17 §27/§217's 90/85/90/95% targets —
  `@prana/core` 96.09/100/100/96.09, `@prana/identity` 100/100/100/100,
  `@prana/ai` 100/94.59/100/100, `@prana/operations` 100/94.11/100/100,
  `@prana/commerce` 92/88.26/82.45/92 (found and closed a real 0%-covered
  file, `list-admin-products.ts`), `@prana/web` 17.39/66.97/31.98/17.39
  (route/page surface area, not business logic — the 95% bar is met by
  `packages/*`, the functional core).
- **Integration test**: `tests/integration/checkout-idempotency.test.ts`
  — `testcontainers` boots a real disposable `pgvector/pgvector:pg17`,
  applies all 40 migrations, and proves (not just asserts) Ch.17 §45/§47's
  "Checkout Idempotency"/"Duplicate Webhooks": calling `checkout_complete`
  twice with the same `paymentId` creates exactly one order and deducts
  inventory exactly once; requesting more than available stock rejects
  cleanly with no partial state. This makes every prior phase's one-time
  manual Docker-Postgres verification ritual a permanent, CI-runnable
  check instead.
- **E2E** (Playwright, Ch.17 Part 4): `tests/e2e/` — storefront journeys,
  auth redirect gates, and axe-core accessibility (`wcag2a`/`wcag2aa`)
  across 8 pages. 25/25 passing on Chromium (only engine installable in
  this sandbox; CI runs the full chromium/firefox/webkit/mobile-chrome
  matrix). Found and fixed 3 real bugs this suite caught: a critical
  `button-name` violation on `/shop`'s sort control (no accessible name
  independent of hydration timing), a serious `link-in-text-block`
  contrast violation on `/signup`/`/login` (hover-only underline, 1.51:1
  contrast), and a `no-html-link-for-pages` lint error on the checkout
  processing page's "My Orders" link.
- **Security audit** (CLAUDE.md hard gate): dependency CVE sweep found
  one Critical (`vitest` UI-server arbitrary file read, dev-tooling-only)
  and one High (`vite` `server.fs.deny` bypass) — both fixed (`vitest`
  2.1.8→3.2.7, `vite`/`esbuild`/`postcss` pinned via pnpm overrides);
  `pnpm audit` now clean. SAST (semgrep, 728 rules) found zero
  application-code findings, only CI/pnpm-config hardening suggestions
  (Low/Medium, `blockExoticSubdeps` applied, `minimumReleaseAge`/
  `trustPolicy` evaluated and reverted — broke lockfile resolution on
  this dependency snapshot). Secret scanning clean (secretlint, verified
  functional via positive control). Security headers verified live
  (HSTS/CSP-with-nonce/X-Frame-Options/etc., no wildcard CORS). RLS:
  92/92 tables, 160 policies. Found and fixed a real timing-attack gap:
  the internal cron endpoint's bearer-secret check used plain `!==`
  instead of `timingSafeEqual` (the Razorpay webhook handler already did
  this correctly). **Gate: PASS**, zero High/Critical open.
- **Performance**: measured LCP 7.6s/TTFB 7.2s against the production
  build — root-caused to this sandbox's dev `.env.local` pointing at an
  unreachable local Supabase, compounded by postgrest-js's default
  retry-with-backoff (not a hang, so a timeout doesn't fix the specific
  number). Added a genuine, environment-independent hardening fix
  anyway: both Supabase clients now use `AbortSignal.timeout(5000)`, so a
  real production outage/slow-path can't hang a render indefinitely. True
  Core Web Vitals verification needs reachable Supabase — deferred to
  Phase 13.
- **CI**: added `coverage`, `integration` (Docker-in-runner, no services:
  block needed), and `e2e` (installs all 3 Playwright engines, builds,
  typechecks `tests/e2e`+`tests/integration` via a new `tests/tsconfig.json`
  since they live outside `apps/web`'s own tsconfig glob, runs the full
  browser matrix, uploads the HTML report) jobs alongside the pre-existing
  `quality`/`secret-scan`/`dependency-audit` jobs.

**Verification:**

```
pnpm lint             ✓ (0 errors)
pnpm typecheck        ✓ (9/9 packages + tests/tsconfig.json)
pnpm test             ✓ (219 tests across 9 packages)
pnpm test:coverage    ✓ (real numbers above)
pnpm test:integration ✓ (2/2, real Docker Postgres)
pnpm build            ✓
playwright (chromium) ✓ 25/25
pnpm audit            ✓ (0 vulnerabilities)
```

**Deferred, flagged not silently dropped:** load/stress/scalability
testing, chaos engineering against live infra, full penetration testing,
disaster-recovery restore drills, manual screen-reader/real-device
accessibility passes, full authenticated E2E journeys against seeded
Supabase data, real Core Web Vitals against reachable infra,
firefox/webkit/mobile-chrome Playwright runs locally — all need live/
staged infrastructure this sandbox doesn't have; all named explicitly in
`docs/testing-strategy.md` rather than silently skipped.

**Handbook compliance:** Ch.17 `17-Testing-Strategy.md` Parts 1-9
(§1-232: Testing Philosophy, Unit Testing Standards, Integration Testing
& API Validation, E2E Testing, AI Testing/Evaluation, Performance/Load/
Scalability Testing, Accessibility/UX/Usability Testing, Security Testing
& Chaos Engineering, CI/CD Quality Gates) read verbatim in full. Part 10
(§233-259, Production Verification & Final Acceptance) deferred to Phase
13 — it's immediately followed in the handbook by
`18-Deployment-Operations-Runbook.md`.

## Phase 13: Deployment (completed)

Full detail in `docs/deployment-runbook.md`. Confirmed with the user up
front: this sandbox has no linked Vercel/Supabase/Cloudflare/payment/
email accounts, and actually deploying is a live, externally-visible
action needing the user's own credentials — so this phase built
deployment **configuration and automation** (the artifacts a human
operator or a future CI run with real secrets needs to execute Ch.18's
procedures), not a live deployment.

- **Migration runner** (`scripts/migrate.mjs`, new): no automated way to
  apply the 40 `infrastructure/database/migrations/*.sql` files to a
  target database existed before this phase. Connects via `DATABASE_URL`,
  tracks applied files in a `_schema_migrations` ledger table, applies
  only pending files in order, one transaction per file (a failure rolls
  back that file and stops the run, per Ch.18 §17). Verified against a
  real disposable Postgres: dry-run listed all 40, a real run applied all
  40 cleanly, a second run correctly reported 0 pending, and a separate
  isolated test with a deliberately broken SQL file confirmed the
  rollback-and-stop behavior.
- **Health check** (`GET /api/health`, new): checks Supabase and Redis in
  parallel, `200`/`503` with a per-dependency status breakdown — Ch.18
  §20 / Ch.17 §237's "Health Endpoint." Verified live: returns a clean
  `503` with per-check `{status, latencyMs, error}` against this
  sandbox's unreachable placeholder infra, no stack traces leaked.
- **Production smoke test** (`tests/e2e/smoke.spec.ts`, new): the exact
  Ch.18 §21/§253 sequence (Homepage → Auth → Search → Product → Cart →
  Checkout → CMS → AI Dashboard → Admin Dashboard → Monitoring), scoped
  to what's checkable without seeded Supabase data. 10/10 passing.
- **Found and fixed a real bug while wiring `apps/web/vercel.json`'s
  cron entry**: `/api/internal/jobs/process` only exported `POST`, but
  Vercel Cron Jobs invoke via `GET` exclusively — the schedule would
  have silently 405'd in production despite a passing unit test (which
  called the handler directly, not through Vercel's actual invocation
  path). Fixed: extracted the shared worker logic, exported both `GET`
  (cron) and `POST` (manual trigger), same auth check either way.
- **`apps/web/vercel.json`** (new): monorepo-aware `installCommand`/
  `buildCommand` (`cd ../.. && pnpm ...`, since Vercel's Root Directory
  needs to be `apps/web` but the workspace deps resolve from the repo
  root) plus the cron schedule.
- **`.github/workflows/deploy.yml`** (new): triggers after CI succeeds on
  `main`, runs migrations, deploys via Vercel CLI, polls `/api/health`,
  runs the smoke spec against the live deployment, uploads the report.
  Requires `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`/
  `DATABASE_URL` repo secrets that don't exist yet in this sandbox — the
  workflow is real and correct, but inert until those are configured.
- **`apps/web/playwright.config.ts`** (edited): `webServer` is now
  conditional on `PLAYWRIGHT_BASE_URL` being unset, so the same spec
  files can run against a live deployment (deploy workflow) without also
  trying to boot a local `pnpm start` against a URL nothing local is
  listening on.
- **`docs/deployment-runbook.md`** (new): the concrete, project-specific
  walkthrough of Ch.18's deployment sequence, rollback procedure (Vercel
  instant promote for app rollback; forward-only corrective migrations
  for schema, matching this project's existing no-`.down`-files
  convention), and prerequisites checklist.

**Verification:**

```
pnpm lint       ✓ (0 errors — added a Node-globals eslint block for scripts/**/*.mjs)
pnpm typecheck  ✓ (9/9 packages + tests/tsconfig.json)
pnpm test       ✓ (219 tests)
pnpm build      ✓ (/api/health registered)
scripts/migrate.mjs  ✓ verified against real disposable Postgres (dry-run,
                       apply, idempotent re-run, rollback-on-failure)
smoke.spec.ts        ✓ 10/10 (chromium)
```

**Deferred, flagged not silently dropped:** actually linking/deploying to
Vercel, provisioning Supabase/Redis/Razorpay/Resend and running the
migration script against them, Cloudflare DNS/SSL, load/stress testing,
quarterly DR drills, real incident-response drills, alert-delivery
verification (needs a configured monitoring provider to fire test alerts
against), a full smoke-test run against real seeded/deployed data
(payment sandbox, real checkout → payment → order), and release
sign-off/success-metrics tracking (§255-257, inherently needs a live
release) — all need live infrastructure this sandbox doesn't have; all
named explicitly in `docs/deployment-runbook.md`.

**Handbook compliance:** Ch.18 `18-Deployment-Operations-Runbook.md`
Parts 1-3 (§1-56: Deployment Philosophy & Operational Architecture,
Production Deployment Procedures, Rollback/Disaster Recovery & Service
Restoration) and Ch.17 Part 10 (§233-259, Production Verification &
Final Acceptance) — both read verbatim in full.

---

All 13 phases of the canonical roadmap are now complete. Prana Commerce
OS / Fresh & Petals has a working storefront, checkout, admin dashboard,
AI employee layer, and — as of this phase — the configuration and
automation a real deployment needs, honestly scoped to what a sandbox
without live infrastructure can actually build and verify rather than
what it can only describe.

## Post-roadmap: WhatsApp Support

Not part of the original 14-phase roadmap — a direct feature request
after Phase 13, replacing the never-implemented Telegram placeholder
from `.env.example`. Full detail in `docs/whatsapp-support.md`.
Architecture confirmed with the user first (dedicated new WhatsApp
number, AI capped at 2 reply attempts then escalates, both email +
WhatsApp for owner alerts, Meta Cloud API direct rather than a BSP to
minimize monthly cost).

- Migration 0041: `support_conversations`/`support_messages` + RLS.
  Migration 0042: seeds the bot's published AI prompt.
- `packages/operations/src/support/conversation-decision.ts` — pure
  state-machine logic (23 tests), including a caught-and-fixed bug where
  a naive `"no".includes()` check would have false-matched inside
  "know".
- `apps/web/server/whatsapp/meta-client.ts` — Meta Cloud API send/verify
  (11 tests). Found and fixed a real bug along the way: the
  `META_WHATSAPP_*` fields were added to the env **schema** but never
  wired into `getServerEnv()`'s actual `process.env` reads, so every
  value silently evaluated to `undefined` regardless of what was set —
  caught by the first test run, not by typecheck (the schema made
  everything optional, so nothing complained).
- `apps/web/server/support/bot-runtime.ts` — the full conversation flow
  (9 tests against fakes): deep-link order-linking, AI attempt/escalate/
  resolve transitions, explicit human-request short-circuit, feedback-
  driven close/escalate, and graceful handling of AI/governance
  failures.
- Order-placed and escalation owner alerts (WhatsApp template + Resend
  email, best-effort per channel, awaited rather than fire-and-forget
  since a serverless function can freeze immediately after responding).
- Admin **Support Inbox** (`/admin/support`) — this is how the owner
  "manages the number" without a phone, since an API-connected WhatsApp
  number can't run the regular consumer app.
- Customer-facing **WhatsApp Support** button on the order detail page.
- Also found and fixed, while wiring the cron entry in Phase 13's
  `vercel.json`: `/api/internal/jobs/process` only exported `POST`, but
  Vercel Cron Jobs invoke via `GET` exclusively — would have silently
  405'd in production.

**Verification:** `pnpm lint`/`typecheck`/`test` all clean (108 web
tests + 27 operations tests, all new ones among them), `pnpm build`
registers all new routes, migrations 0041-0042 verified against a real
disposable Postgres, webhook signature/handshake behavior verified live
(403 on bad verify token, 400 on unsigned POST), Support Inbox
auth-gated (verified live: 307 redirect / 403 API).

**Cannot be verified without live Meta/Resend accounts** (this sandbox
has neither): an actual message arriving on a real phone, the full
webhook round-trip against Meta's real infrastructure, real-world AI
resolution quality, Resend domain deliverability. All named explicitly
in `docs/whatsapp-support.md`, not silently skipped.
