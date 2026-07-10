# Backend Architecture

Implementation of Handbook **Ch.11 Part 1** (§1–17), re-read verbatim (same
discipline as every prior phase — it's short, ~580 lines, no excuse to rely
on the Phase 0 summary for something this foundational). This is the
pattern every later feature phase (6, 8, 9, 10, 11) repeats — one real
vertical slice (`GET /api/v1/products`) proves it end-to-end; it does not
rebuild every aggregate's business logic, that's each feature phase's job.

## Layer split (Ch.11 §5/§6)

| Layer                                       | Lives in                                         | Depends on                                                                                |
| ------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Domain (types, repository interfaces)       | `packages/commerce/src/domain/`                  | nothing but `@prana/core`                                                                 |
| Application (use-case services)             | `packages/commerce/src/application/`             | only the repository _interface_ — no Supabase, fully unit-testable with an in-memory fake |
| Infrastructure (concrete repositories)      | `apps/web/server/repositories/`                  | `@supabase/supabase-js`, the domain interface it implements                               |
| Presentation (routes, envelope, validation) | `apps/web/app/api/v1/*`, `apps/web/server/http/` | everything above, composed                                                                |

`packages/core` (errors, `Result`, `DomainEvent`, base `Repository`) has no
dependencies at all — every other domain package depends on it, never the
other way around.

## AppError hierarchy (Ch.11 §12) — exact 7 classes, no 8th invented

`ValidationError` (422), `AuthenticationError` (401), `AuthorizationError`
(403), `BusinessRuleError` (409, but constructor-overridable — e.g.
`new BusinessRuleError('not found', { httpStatus: 404 })`, since the
handbook names exactly 7 classes and "not found" doesn't warrant an 8th),
`PaymentError` (402), `InfrastructureError` (500), `ExternalServiceError`
(502). Every one's `httpStatus`/`code` is asserted in
`packages/core/src/errors.test.ts`.

## Result<T, E> pairs with AppError

Application services return `Result<T, AppError>` instead of throwing —
`route-handler.ts` unwraps it into the `{success,data,meta,error}` envelope
(Ch.11 §10) at the presentation boundary. A _thrown_, unexpected exception
still gets caught and mapped to a generic `InfrastructureError` (500) —
never a raw stack trace to the client (§12) — but the expected/handled
failure path is `Result`, not `try/catch`.

## The transaction-boundary reality PostgREST forces on you

Ch.11 §8 describes "Create Order: BEGIN → reserve inventory → create
payment → create order → COMMIT" as an application-service transaction.
**This cannot be built as several sequential repository calls** — every
Supabase client call is its own PostgREST HTTP request/transaction; nothing
about calling three `.from(...)` methods in a row gives atomicity, no
matter how they're sequenced in JS. The only way to get real
BEGIN/COMMIT/ROLLBACK semantics through PostgREST is a single Postgres
function call (`.rpc(...)`) — the function body _is_ the transaction.

This phase proves the pattern with something smaller but real: claiming a
job from the `jobs` queue needs `FOR UPDATE SKIP LOCKED` so two concurrent
workers never grab the same row — impossible to express as a PostgREST
filter. `claim_next_job` (`infrastructure/database/migrations/0020`) is a
plpgsql function; `SupabaseJobQueue.claimNext()` calls it once. **Phase 10's
order-creation flow must follow this same shape** — a `create_order`
Postgres function, not a repository method that calls three other
repository methods and hopes.

## Security chain (Ch.11 §16)

Security Headers apply globally (`next.config.ts` `headers()` — CSP, HSTS,
X-Frame-Options, etc. — `connect-src` currently only allows Supabase;
Razorpay/Maps/Sentry domains get added when Phase 9/10/13 actually wire
them, not guessed at now). Rate-limit → bot-detection → auth → authz run
per-route via `runSecurityChain()` (`apps/web/server/security/chain.ts`),
called explicitly at the top of each route handler — validation is the
route-handler's own job (Zod schema → envelope on failure).

Rate limit tiers (`server/security/rate-limit.ts`) use the **Ch.16 §19**
numbers (anonymous 200/min, authenticated 500/min, login 10/15min,
checkout 20/min, admin 100/min) rather than Ch.14/15's slightly different
admin figure (30/min) — the API-spec chapter is the more specific authority
for API-layer limits; the discrepancy itself is a known handbook
inconsistency, not something introduced here.

Bot detection defers to Cloudflare's own bot score header when present
(the real control, configured at the edge in Phase 13) and only falls back
to a minimal user-agent heuristic when that header is absent (local dev).

## Logging (Ch.11 §13)

Structured JSON to stdout (Vercel captures/indexes this natively) — no
vendor named for v1 in the handbook, so none was added speculatively.
Redacts any field whose key matches password/token/secret/authorization/
api[-_]?key/refresh_token, recursively through nested objects, before
serializing.

## Verified, not just written

- Unit tests: `AppError` hierarchy (10), `Result` (4), `ListProductsService`
  against an in-memory fake repository including its failure path (2),
  `processNextJob`'s retry/backoff math including the 1-hour cap (4),
  envelope shape (3), the full `createApiRoute` pipeline — success, mapped
  `AppError`, Zod rejection, unhandled-exception-never-leaks (4), bot
  detection (6), rate-limit tier constants (2), logger redaction (4).
  57 tests total across the workspace.
- **Real integration test, not mocked**: stood up Postgres (with every
  migration through 0020 applied) + a real PostgREST container, seeded a
  published product, and queried it with the _exact_ select string
  `SupabaseProductRepository` uses
  (`product_prices(base_price,sale_price)` embedded). Confirmed PostgREST
  infers the one-to-one cardinality from `product_prices.product_id`'s
  UNIQUE constraint and returns an **object**, not an array — the one
  genuinely unverifiable-by-typechecking assumption in this phase, now
  proven against the real REST layer rather than assumed.
- Full `next build` (Turbopack) succeeds with both new routes registered.

## Two build-breaking issues found and fixed this phase

1. **`packages/*` weren't being transpiled by Next.js.** They ship
   TypeScript source directly (no build step). Fixed with
   `transpilePackages` in `next.config.ts` — the documented, standard fix
   for this monorepo pattern.
2. **Relative imports using a `.js` extension (e.g. `from './errors.js'`)
   broke Turbopack specifically**, even though `tsc` and Vitest both
   resolved them fine. Our `tsconfig.base.json` uses
   `moduleResolution: "Bundler"`, which — unlike `NodeNext` — doesn't
   require or even expect the `.js`-extension-for-a-`.ts`-file convention;
   Turbopack's resolver took the extension literally, looked for a file
   named `errors.js` that doesn't exist, and silently produced "module has
   no exports at all" instead of a clear error. Fixed by stripping `.js`
   from every relative import across `packages/*` — consistent with the
   `Bundler` resolution mode already configured. **Worth remembering**:
   any new file added to `packages/*` should use extensionless relative
   imports, not `./foo.js`.

## What's deferred (by design, not oversight)

- Every other aggregate's repository/application service (categories,
  orders, AI tasks, blogs, ...) — built as each owning feature phase (6, 8,
  9, 10, 11) needs it, following the exact pattern this phase established.
- The real `create_order` transactional RPC — Phase 10, following the
  `claim_next_job` shape documented above.
- Real background job _types_ (email, image optimization, embeddings,
  invoices) — `sample.ping` is a deliberately trivial proof that the queue
  mechanism itself works; each real type registers in
  `JOB_HANDLERS` when its owning phase implements it.
- Observability vendor (Sentry, per your canonical decision) — Phase 13.
- Vercel Cron schedule actually calling `/api/internal/jobs/process` —
  Phase 13 deployment config.
