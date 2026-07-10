# Deployment & Operations Runbook (Phase 13)

Implementation of the canonical roadmap's Phase 13, read against Ch.18
(`18-Deployment-Operations-Runbook.md`, all 3 Parts, §1-56) and Ch.17
Part 10 (§233-259, Production Verification & Final Acceptance — grouped
here rather than Phase 12 since it's immediately followed in the handbook
by Ch.18) — both read verbatim in full.

## Scope decision: readiness artifacts, not a live deployment

Ch.18/§233-259 assume a deployed, reachable stack: a linked Vercel
project, a provisioned Supabase project, Cloudflare DNS, Upstash Redis,
Razorpay, Resend, Sentry — none of which exist in this sandbox, and
linking/deploying to real accounts is a live, externally-visible action
that needs the user's own credentials and explicit authorization, not
something to do silently mid-build. Confirmed directly with the user:
this phase builds deployment **configuration and automation** — the
artifacts a human operator (or a future CI run with real secrets) needs
to actually execute Ch.18's procedures — without touching any live
account. Load testing, quarterly DR drills, real incident response, and
the 99.9%-uptime success metrics (§257) are inherently unmeasurable
without a live production system serving real traffic; deferred, same as
every other "needs live infra" item from Phase 12.

## What was built and verified

### 1. Migration runner — Ch.18 §17 Database Migration Procedure

No automated way to apply `infrastructure/database/migrations/*.sql` to a
target database existed before this phase (every prior phase applied
migrations by hand against a disposable Docker Postgres for
verification, with no path to production). `scripts/migrate.mjs`:

- Connects via `DATABASE_URL`, creates a `_schema_migrations` ledger
  table if missing, applies only files not yet in the ledger, in
  filename order.
- Each file runs in its own transaction — a failure rolls back that file
  only, stops the run immediately (§17: "Migration failures trigger
  rollback"), and leaves already-applied files committed.
- `--dry-run` lists pending files without applying them (§17 Step 1
  "Review migration").
- Idempotent by construction: re-running against an up-to-date database
  reports "0 pending" and does nothing.

Verified against a real disposable `pgvector/pgvector:pg17` container
this phase: dry-run correctly listed all 40 files; a real run applied
all 40 cleanly (93 tables including the ledger); a second run correctly
reported 0 pending; a separate isolated test with a deliberately invalid
SQL file confirmed the transaction-per-file rollback behavior — the
prior good file stayed committed, the broken file rolled back, the run
stopped rather than continuing past a failure.

### 2. Health check endpoint — Ch.18 §20 / Ch.17 §237

`GET /api/health` (new) — checks Supabase (a cheap `system_settings`
select) and Redis (`PING`) in parallel, returns `200 {"status":"ok",...}`
if both are up or `503 {"status":"degraded",...}` with a per-dependency
`{status, latencyMs, error?}` breakdown if either is down. Deliberately
unauthenticated (monitoring services can't hold a session) and outside
`runSecurityChain` (health checks are polled far more often than normal
traffic and shouldn't compete for the anonymous rate-limit budget).
Verified live against this sandbox's unreachable placeholder Supabase/
Redis: returns `503` with `{"database":{"status":"down","error":"TypeError:
fetch failed"},"redis":{"status":"down","error":"fetch failed"}}` — no
stack trace, no internal detail beyond a short error string, exactly the
shape a real outage would produce.

### 3. Production smoke test — Ch.18 §21/§253

`tests/e2e/smoke.spec.ts` — the deployment pipeline's post-deploy gate
(§19: "Verify Health Checks → Run Smoke Tests → Monitor → Deployment
Complete"), scoped to what's genuinely checkable without seeded
Supabase data: homepage, login form render, search, product-route 404
handling (not a 500), cart, checkout guest-redirect, blog (CMS surface),
AI Dashboard guest-redirect, Administrator Dashboard guest-redirect, and
`/api/health` returning a structured status. Run directly (separate from
the full Phase-12 E2E suite, which covers more ground but takes longer
than the runbook's 5-minute budget):

```
pnpm exec playwright test --config=apps/web/playwright.config.ts smoke.spec.ts
```

### 4. Vercel Cron ↔ job-processor mismatch — found and fixed

While wiring `apps/web/vercel.json`'s `crons` entry against
`/api/internal/jobs/process`, found the route only exported `POST` —
Vercel Cron Jobs invoke via `GET` exclusively. This would have meant the
schedule silently 405'd against a route that looked complete and had a
passing unit test (the test called it as a plain function, not through
Vercel's actual invocation path). Fixed: extracted the shared worker
logic, exported both `GET` (cron-triggered) and `POST` (manual
operator-triggered), same shared-secret check either way.

### 5. `apps/web/vercel.json` — monorepo build wiring

`installCommand`/`buildCommand` `cd ../.. && pnpm ...` so Vercel installs
and builds from the workspace root (required for `apps/web` to resolve
its `@prana/*` workspace package dependencies) even though the Vercel
project's Root Directory should be set to `apps/web` (a dashboard
setting, not file-based — documented below since it can't be committed
as a repo artifact). `crons` schedules `/api/internal/jobs/process`
every minute, matching the `docs/ai-employees.md`/Phase 6 job-queue
design's "processed by whatever polls it" intent.

## Concrete deployment procedure (Ch.18 Part 2 walked through for this project)

**Prerequisites (§14/§18)** — before any deploy:

1. A Vercel project exists, linked to this repo, **Root Directory** set
   to `apps/web` in Project Settings → General.
2. A Supabase project exists (its own migrations applied — see below).
3. Environment variables set in Vercel (Project Settings → Environment
   Variables), one value per environment (Preview/Production never share
   secrets, per §4): every var in `.env.example` that
   `apps/web/config/env.ts`'s `serverEnvSchema` requires
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`,
   `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`) is **mandatory** — the app
   throws at first access (zod `.parse`, not `.safeParse`) if any is
   missing, so a misconfigured deploy fails loudly on the first request
   rather than serving broken pages. AI provider keys
   (`ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`GROQ_API_KEY`) and payment keys
   (`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET`) are
   schema-optional — an unconfigured one fails closed at the point of use
   (e.g. `no_model_available`, checkout's payment-order step erroring)
   rather than crashing the whole app at boot.
4. `pnpm audit --audit-level=high` and the `security-audit` skill both
   clean (Phase 12's hard gate — re-run before every production
   deploy, not just once).

**Sequence (§19, this project's concrete form of "Production Branch →
Build → Deploy Application → Run Database Migration → Restart Workers →
Verify Health Checks → Run Smoke Tests → Monitor → Deployment
Complete")**:

```
1. Merge to main (CI's quality/coverage/integration/e2e/secret-scan/
   dependency-audit jobs must all be green — .github/workflows/ci.yml)
2. Vercel auto-deploys main → Production (or `vercel --prod` manually)
3. DATABASE_URL=<supabase-connection-string> node scripts/migrate.mjs
   (review pending files with --dry-run first)
4. curl https://<domain>/api/health — must return 200
5. pnpm exec playwright test --config=apps/web/playwright.config.ts smoke.spec.ts
   (point PLAYWRIGHT_TEST_BASE_URL / the config's baseURL at production)
6. Observe Vercel/Supabase dashboards for 30 minutes minimum (§24) — no
   critical alerts
7. Record the deployment (version/commit/migration version/duration/
   result) — Vercel's own deployment list already captures commit SHA,
   timestamp, and duration; this project doesn't yet have a separate
   deployment-log table, so today that list plus the migration ledger
   (`_schema_migrations`, timestamped per file) together satisfy §26
```

**Rollback (§37/§38)**:

- **Application**: Vercel's "Promote to Production" on the previous
  deployment is an instant, built-in rollback — no redeploy/rebuild
  needed. This is the primary mechanism; no custom tooling required.
- **Database**: migrations in this project are forward-only (no `.down`
  files) — per §38, "data integrity has priority over deployment speed."
  A bad migration is fixed by writing and applying a new corrective
  migration, not by reverting the schema out from under data that may
  already reference it. `scripts/migrate.mjs`'s transaction-per-file
  behavior means a migration that fails partway never leaves the schema
  in a half-applied state for that one file.

## Deferred to when live infrastructure exists

- Actually linking/deploying to a Vercel project
- Actually provisioning Supabase/Upstash Redis/Razorpay/Resend and
  running `scripts/migrate.mjs` against them
- Cloudflare DNS/SSL configuration
- Load/stress/scalability testing, quarterly DR drills, real incident
  response drills (Ch.18 §55, Ch.17 Part 6)
- Alert delivery verification (§244) — needs a configured monitoring
  provider (Sentry/Vercel Analytics, per the canonical decisions) to
  actually fire test alerts against
- Full production smoke test run against a real deployment with seeded
  data (payment sandbox validation, real checkout → payment → order
  flow)
- Release sign-off / success-metrics tracking (§255-257) — inherently
  needs a live release to sign off on

## Handbook compliance

Ch.18 `18-Deployment-Operations-Runbook.md` Parts 1-3 (§1-56: Deployment
Philosophy & Operational Architecture, Production Deployment Procedures,
Rollback/Disaster Recovery & Service Restoration) and Ch.17 Part 10
(§233-259, Production Verification & Final Acceptance) — both read
verbatim in full.
