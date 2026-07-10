# System-wide Testing (Phase 12)

Implementation of the canonical roadmap's Phase 12, read against Ch.17
(`17-Testing-Strategy.md`, all 10 Parts, §1-259) read verbatim in full.
Part 10 (§233-259, Production Verification & Final Acceptance) belongs
conceptually to Phase 13 (Deployment) since it's immediately followed in
the handbook by `18-Deployment-Operations-Runbook.md` — deferred there.

## Scope decision: what's genuinely executable in this sandbox vs. deferred

Ch.17's targets include enterprise-scale requirements (1000-concurrent-
user load testing, 24-hour endurance runs, chaos engineering against live
infra, full penetration testing, disaster-recovery restore drills, manual
screen-reader passes) that need a deployed, reachable staging environment
this sandbox doesn't have (no live Supabase, no Redis, no AI provider
keys, no production DNS/CDN). Rather than fabricate numbers against
infrastructure that doesn't exist, this phase built and ran everything
that genuinely exercises real code paths, and documents the rest as
deferred to Phase 13 (live/staging infra) — same "deferred, flagged, not
silently dropped" discipline used for Resend/WhatsApp/Payment
Reconciliation in earlier phases.

## What was built and verified

### 1. Coverage tooling — real numbers against Ch.17 §27/§217 targets

`@vitest/coverage-v8` wired into every package (`apps/web` +
`packages/{ai,commerce,core,identity,operations}`) via `vitest.config.ts`
`coverage` blocks, `test:coverage` script per package, `turbo run
test:coverage` at root. Target: Statements 90 / Branches 85 / Functions
90 / Lines 90, Business Logic 95%+.

Real numbers (this run):

| Package             | Statements | Branches | Functions | Lines  |
| ------------------- | ---------- | -------- | --------- | ------ |
| `@prana/core`       | 96.09%     | 100%     | 100%      | 96.09% |
| `@prana/identity`   | 100%       | 100%     | 100%      | 100%   |
| `@prana/ai`         | 100%       | 94.59%   | 100%      | 100%   |
| `@prana/operations` | 100%       | 94.11%   | 100%      | 100%   |
| `@prana/commerce`   | 92%        | 88.26%   | 82.45%    | 92%    |
| `@prana/web`        | 17.39%     | 66.97%   | 31.98%    | 17.39% |

`@prana/web`'s low statement/line number is component/route-surface-area
(69 API routes, ~40 pages) rather than a real business-logic gap — the
handbook's 95% "Business Logic" bar applies to `packages/*` (the
functional core), which all clear 92%+; `apps/web` is largely thin
routing/composition over that core, exercised today by the 20 unit test
files plus the new Playwright E2E suite rather than per-component unit
tests. Found and closed one genuine gap during this pass:
`list-admin-products.ts` had 0% coverage (no test file existed) — added
`list-admin-products.test.ts` (4 tests: list-all, status filter,
case-insensitive search, repository-failure → `InfrastructureError`),
raising `@prana/commerce` from 88.28/87.14/78.18/88.28 to 92/88.26/82.45/92.

### 2. Integration test — Ch.17 §45 "Checkout Idempotency" / §47 "Duplicate Webhooks", made permanent

Every migration/RPC in this project was hand-verified against a
disposable Docker Postgres during its own phase, one time, manually. This
phase converts that ritual into a real, CI-runnable automated test:
`tests/integration/checkout-idempotency.test.ts` uses `testcontainers` to
boot a real `pgvector/pgvector:pg17` container, applies the Supabase auth
shim + all 40 migrations, seeds a minimal fixture (outlet, category,
product, price, inventory, customer), then:

- Calls `checkout_start` once, then `checkout_complete` **twice** with the
  identical `paymentId` — asserts exactly one `orders` row exists and
  inventory is deducted exactly once (physical 10→8, reserved 0), proving
  the RPC's `payments.idempotency_key` uniqueness guard actually holds
  under a simulated duplicate webhook delivery, not just in theory.
- Calls `checkout_start` requesting more units than are in stock — asserts
  it rejects with `Insufficient inventory` and causes no partial state
  change.

Runs via `pnpm test:integration` (root `vitest.config.ts`, scoped to
`tests/integration/**/*.test.ts`; a hard prerequisite is a reachable
Docker daemon — the test throws a clear error naming this if `.start()`
fails, rather than silently skipping). Wired into CI as its own job
(`integration`) — GitHub-hosted `ubuntu-latest` runners have Docker
available by default, so `testcontainers` works without a services:
block. Verified passing locally: 2/2 tests, ~4s.

### 3. E2E — Playwright, Ch.17 Part 4 (§67-99)

`tests/e2e/` (three spec files, all passing on the locally-available
Chromium project — 25/25 tests):

- `storefront.spec.ts` — homepage/shop/search/blog load without console
  errors, static pages (`/faq`, `/contact`, `/privacy`, `/terms`,
  `/delivery-policy`) all respond <400, cart empty-state renders, unknown
  routes 404.
- `auth-gates.spec.ts` — login/signup forms render their expected fields;
  `/checkout`, `/account`, `/admin`, `/admin/ai` all redirect an
  unauthenticated visitor to `/login` rather than exposing the page or
  erroring. (Full authenticated journeys — login → checkout → payment —
  need a live Supabase project with seeded users, which this sandbox
  doesn't have; deferred to Phase 13.)
- `accessibility.spec.ts` — `@axe-core/playwright`, `wcag2a`/`wcag2aa`
  tags, across `/`, `/shop`, `/blog`, `/login`, `/signup`, `/faq`,
  `/contact`, `/cart`, filtered to critical/serious violations.

The full 4-project browser matrix (chromium/firefox/webkit/mobile-chrome,
per `apps/web/playwright.config.ts`) only runs in CI in this sandbox —
only Chromium is installed locally (`~/.cache/ms-playwright` has no
firefox/webkit binaries); the CI `e2e` job installs all three via
`playwright install --with-deps`.

**Real bugs found and fixed by this suite** (not hypothetical — these
failed on the first run):

1. `accessibility.spec.ts` caught a `button-name` (critical) violation on
   `/shop`: the sort `<Select>`'s trigger had no accessible name of its
   own, relying entirely on the currently-selected `SelectValue` text.
   Fixed: `apps/web/components/storefront/shop-sort-control.tsx` now sets
   `aria-label="Sort products"` on the trigger.
2. `accessibility.spec.ts` caught a `link-in-text-block` (serious)
   violation on `/signup`: the "Sign in" link inside body copy had 1.51:1
   contrast against its surrounding text (required 3:1) and no
   underline until hover, so it wasn't distinguishable without color.
   Fixed in `signup/page.tsx`, `login/page.tsx`, and (found by manual
   inspection of the same pattern) the checkout processing page — all
   three now use a permanent `underline` instead of `hover:underline`.
3. `pnpm lint` (run as part of closing this phase) caught a real
   `no-html-link-for-pages` error in
   `checkout/[sessionId]/processing/page.tsx` — a stray `<a>` tag doing a
   full-page navigation where `next/link` was intended. Fixed.

### 4. Accessibility — Ch.17 Part 7 (§154-181), WCAG 2.2 AA target

Automated slice covered by `accessibility.spec.ts` above (axe-core via
Playwright). §160/§179's manual screen-reader and real-device passes are
not something this sandbox can execute and are deferred to Phase 13 —
axe-core "supplements, but does not replace, manual testing" per the
handbook's own §178 wording.

### 5. Performance — Ch.17 Part 6 (§126-153), Core Web Vitals

Ran a real Chrome DevTools performance trace against the production build
(`next build && next start`) locally. Result: LCP 7.6s / TTFB 7.2s — far
outside the §131 targets (LCP≤2.5s, TTFB≤800ms). Root-caused rather than
waved away: this sandbox's `apps/web/.env.local` (gitignored, left over
from earlier phases' local dev setup) points `NEXT_PUBLIC_SUPABASE_URL`
at `http://localhost:54321`, which nothing is listening on here. Every
Supabase query on the homepage hits `ECONNREFUSED`, and
`@supabase/postgrest-js`'s default retry policy (3 attempts, 1s/2s/4s
exponential backoff) adds ~7s before the page can render — confirmed via
`/proc/PID/environ` (no Supabase env vars at the OS/process level; they're
injected later by `@next/env` from the gitignored file) and via
`pnpm why vite`-style tracing through postgrest-js's source.

Fixed the part that's a genuine, environment-independent hardening gap:
neither Supabase client (`lib/supabase/server.ts`, `lib/supabase/admin.ts`)
had any request timeout, so a real production Supabase outage or slow
network path could hang a render for the same multi-second window. Added
`lib/supabase/fetch-with-timeout.ts` (`AbortSignal.timeout(5000)`, merged
with any caller-supplied signal via `AbortSignal.any`) and wired it into
both server-side clients — postgrest-js treats an aborted attempt as
non-retryable, so this also stops the retry backoff from compounding on
top of a hang. This does not fix the specific number measured here
(`ECONNREFUSED` rejects near-instantly, before any timeout would fire —
the delay is the retry sleep afterward, not a hang), so a true Core Web
Vitals measurement needs a reachable Supabase — deferred to Phase 13
against staging.

### 6. Security audit — hard gate (CLAUDE.md, `security-audit` skill)

Full pass run this phase; see the audit summary embedded in this phase's
close-out message for the complete findings table. Headline: dependency
CVE sweep found one Critical (`vitest` <3.2.6, arbitrary file
read/execute via its UI server) and one High (`vite` <6.4.3,
`server.fs.deny` bypass) — both dev-tooling-only (never shipped to the
production bundle; this project doesn't run a Vite dev server or Vitest
UI anywhere) but fixed anyway per the hard-gate policy: `vitest` bumped
2.1.8→3.2.7 across every package, `vite`/`esbuild`/`postcss` pinned via
`pnpm-workspace.yaml` `overrides` to patched versions. `pnpm audit` is
clean (0 vulnerabilities) after the fix. SAST (semgrep, 728 community
rules across security-audit/OWASP-top-ten/Next.js/React/TypeScript/secrets
rulesets) found zero application-code findings — the only 11 hits were
CI-config and pnpm-config hardening suggestions (GitHub Actions mutable
tags, missing `blockExoticSubdeps`/`minimumReleaseAge`/`trustPolicy`),
all Low/Medium. `blockExoticSubdeps` enabled; `minimumReleaseAge` and
`trustPolicy` evaluated but reverted after they broke the existing
lockfile resolution (many current deps are <7 days old; the trust-policy
check false-flagged `semver`/`undici-types`/`eslint-import-resolver-
typescript` — all long-stable, extremely widely used packages) — noted
as accepted, not silently dropped. Secret scanning (secretlint, verified
functional via a positive-control test against a synthetic GitHub token
before trusting a clean result) found nothing in the tracked tree.
Security headers verified live via `curl` against the running production
build (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
Permissions-Policy, COOP, CORP, and a per-request nonce'd CSP — all
present, no wildcard CORS anywhere). Supabase RLS: 92/92 tables have RLS
enabled, 160 policies, zero direct `GRANT ... TO anon/public` statements.
Service-role key confirmed server-only (zero references from any
`'use client'` file). Along the way, also found and fixed a real, if
minor, timing-attack surface: the internal cron job-trigger endpoint
compared its bearer secret with plain `!==` instead of
`crypto.timingSafeEqual` (the Razorpay webhook handler already did this
correctly) — fixed for consistency.

**Gate: PASS.** Zero High/Critical open. Scanned for known/common issues
via automated tooling — this is not a guarantee against a targeted
attacker, and is not a claim that the site is "unhackable" or has "zero
vulnerabilities."

### 7. CI/CD Quality Gates — Ch.17 Part 9 (§209-232)

`.github/workflows/ci.yml` (pre-existing `quality`/`secret-scan`/
`dependency-audit` jobs kept, renamed one step for accuracy) gained three
new jobs this phase:

- `coverage` — runs `pnpm test:coverage` (all packages).
- `integration` — runs `pnpm test:integration` (the Docker-Postgres
  checkout-idempotency suite); GitHub-hosted runners have Docker
  available natively, no services: block needed.
- `e2e` — installs all three Playwright browser engines
  (`--with-deps chromium firefox webkit`), builds the app, typechecks
  `tests/e2e`+`tests/integration` (`pnpm typecheck:tests` — these files
  live outside `apps/web/`'s own `tsconfig.json` `include` glob, so a
  dedicated `tests/tsconfig.json` was added to make sure they're
  genuinely typechecked, not just executed), runs the full 4-project
  Playwright matrix, and uploads the HTML report as a build artifact.

## Deferred to Phase 13 (needs live/staged infrastructure)

- Load/stress/scalability testing (Ch.17 Part 6 concurrent-user targets)
- Chaos engineering against live infra (Ch.17 Part 8)
- Full penetration testing / red-team pass
- Disaster-recovery restore drills
- Manual screen-reader and real-device accessibility passes
- Full authenticated E2E journeys (login → checkout → payment) against
  seeded Supabase data
- Real Core Web Vitals measurement against a reachable Supabase/staging
  environment (this sandbox's ~7s TTFB is an artifact of an unreachable
  local dev Supabase URL, not a code defect — see §5 above)
- Firefox/WebKit/mobile-chrome Playwright runs locally (CI-only in this
  sandbox; browsers aren't installed here)
