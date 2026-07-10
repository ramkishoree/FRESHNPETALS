# Authentication & Authorization

Implementation of Handbook Ch.10 Part 4 (schema — built Phase 3), Ch.14/15
app-level security controls (AuthN providers, password policy, MFA, session
TTLs, account lockout), and Ch.16's Auth API surface. **No pages** — the
canonical roadmap puts the Component Library (Phase 7) before any actual
page (Phase 8/9), so this phase is infrastructure only: Supabase clients,
route protection, session/RBAC/lockout/MFA logic, and Server Actions the
eventual login/register forms will call. Everything here is exercised by
unit tests and a real Turbopack build, not by clicking through a UI that
doesn't exist yet.

## Files

- `apps/web/config/env.ts` — Zod-validated env, split public/server so a
  service-role key can't leak into a Client Component by accident.
- `apps/web/lib/supabase/{client,server,admin}.ts` — three Supabase client
  factories: browser (anon key, Client Components), server (anon key +
  cookies, Server Components/Actions — subject to RLS), admin (service
  role, bypasses RLS, `server-only`-guarded).
- `apps/web/proxy.ts` — session refresh + route protection for `/account`
  and `/admin`. (Named `proxy.ts`, not `middleware.ts` — Next.js 16
  deprecated the latter mid-build; see below.)
- `apps/web/server/auth/{session,actions,lockout,mfa}.ts` — RBAC
  resolution, sign-up/in/out + password reset Server Actions, failed-login
  lockout, admin TOTP MFA wrappers.
- `packages/identity/src/{roles,password}.ts` — framework-agnostic role/
  permission types and password-policy validation; unit tested directly.

## RBAC resolution: service-role lookup, not JWT claims (yet)

`roles`/`user_roles` are admin-or-own-row-only under RLS (migration 0011) —
a customer's own session can't read the `roles` table to translate their
`role_id` into a name, and that's correct, not a bug. `getCurrentUser()`
(`server/auth/session.ts`) resolves the caller's own roles using the
service-role client instead, scoped strictly to `user_id = <the caller>`.
This is secure (never returns another user's data) but does a live DB join
on every check. **Deferred to Phase 4+/Auth hardening**: a Supabase Auth
Hook embedding roles/permissions into the JWT, so `private.is_admin()` (SQL)
and `getCurrentUser()` (TS) can both fast-path off `auth.jwt()` without a
query. Nothing about today's policies or types needs to change when that
lands — it's a performance upgrade, not a redesign.

## Session TTL is role-dependent — Supabase's own JWT expiry isn't

Ch.15 §18 wants a 30-day rolling session for customers and a 12-hour one
for admins. Supabase Auth has one project-wide JWT expiry, not a
per-role one. `proxy.ts` reconciles this itself: every sign-in inserts a
row into `public.sessions` (migration 0004) with `created_at`; on every
`/admin` request, the proxy checks that row's age and forces re-auth past
12 hours, regardless of what the underlying Supabase JWT would otherwise
still allow. Customer routes rely on Supabase's own (longer) JWT expiry.

## Account lockout needed a schema change

Ch.15 §81 (10 failed attempts / 15 minutes) has to count attempts **before**
the user is authenticated — including attempts against emails that don't
match any account. Ch.10 §76's `login_history` only had a nullable
`user_id`, which doesn't exist yet in that case. Added
`attempted_identifier` in migration 0019 (Phase 4, not a retrofit of
Phase 3's files — schema evolves forward via new migrations). `checkLockout`/
`recordLoginAttempt` (`server/auth/lockout.ts`) key off that column via the
admin client, since a not-yet-authenticated request has no session to scope
an RLS-filtered query to anyway.

## MFA — logic only, admin-only

Ch.15 §17: MFA is administrator-only in v1, TOTP. `server/auth/mfa.ts`
wraps Supabase Auth's `auth.mfa.*` API (enroll/verify/unenroll/listFactors).
No UI calls these yet — that's Phase 8 (Admin Dashboard → Settings →
Security). Enforcing that MFA is actually _required_ for admin sign-in
(rather than just available) is a Supabase project-level Auth setting,
Phase 13's job, not application code.

## Password policy is defense-in-depth, not the source of truth

`packages/identity/src/password.ts` (min 12 chars, upper/lower/number/
special, small common-password blocklist) runs before Supabase ever sees
the password, for fast/friendly error messages. Supabase Auth still owns
actual hashing/salting/storage (§79) and must _also_ be configured with a
matching minimum-length rule at the project level (Phase 13) — this
validator doesn't replace that, it fails fast in front of it.

## Guest checkout and RLS

No sign-up is required to buy (Ch.8). Everything in this phase governs
_authenticated_ sessions; the guest-checkout path (an unauthenticated
`customers` row created at checkout time — see `docs/database-schema.md`)
is deliberately untouched here and is Phase 10's concern.

## Discovered mid-build: Next.js 16 deprecated `middleware.ts`

`next build` warned mid-phase that the `middleware` file convention is
deprecated in favor of `proxy` — confirmed by grepping Next's own
`constants.js` (`PROXY_FILENAME = 'proxy'`) and then by the build itself,
which rejected a plain rename until the exported function was also renamed
from `middleware` to `proxy`. Both the file and the export are `proxy` now;
behavior is identical, this is a same-phase framework-convention fix, not a
design change.

## What's still deferred

- Login/register/reset-password **pages** — Phase 8 (Admin) / Phase 9
  (Customer Website), once Phase 7's component library exists to build them
  with.
- JWT custom-claims fast-path for RBAC checks (see above).
- Supabase project-level config: password minimum length, MFA enforcement,
  OAuth provider (Google) client ID/secret, email templates — Phase 13
  deployment/environment provisioning, not application code.
