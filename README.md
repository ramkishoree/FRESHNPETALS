# Prana Commerce OS

AI-powered ecommerce platform. Platform-first, built for reuse across verticals (flowers, bakeries, jewelry, furniture, ...). First implementation: **Fresh & Petals**.

The Engineering Handbook (`INTRO PRD`) is the single source of truth for all product, architecture, and business-rule decisions. This repository implements it phase by phase — see `docs/implementation-plan.md` for the canonical roadmap and current phase status.

## Monorepo Layout

```
apps/
  web/                Next.js 16 App Router — customer site + admin dashboard
packages/
  core/                Shared domain primitives (result types, errors, ids)
  commerce/            Product, inventory, pricing, cart, order, payment domain
  identity/            Auth, roles, permissions, sessions
  marketing/            Blog, CMS, campaigns, offers, coupons
  ai/                  AI gateway, orchestrator, agents, memory, workflows
  analytics/           Business/AI analytics domain
  operations/          Ops workflows, admin task orchestration
  shared/              Cross-domain types, constants, validation schemas
infrastructure/
  database/            Migrations, seeds, RLS policies
  events/               Domain event contracts, outbox
  workers/             Background job handlers
scripts/                Operational scripts (CI-invoked or one-off)
tests/
  e2e/                 Playwright specs spanning the full stack
  integration/          Cross-package integration tests
```

## Requirements

- Node.js 22+
- pnpm 11+

## Getting Started

```bash
pnpm install
cp .env.example apps/web/.env.local   # fill in real values, never commit
pnpm dev
```

## Common Commands

```bash
pnpm dev            # run all apps in dev mode
pnpm build          # build all apps/packages
pnpm lint           # eslint across the workspace
pnpm typecheck      # tsc --noEmit across the workspace
pnpm test           # unit + integration tests
pnpm test:e2e       # Playwright end-to-end tests
pnpm format         # prettier --write
```

## Engineering Rules

- Business logic never lives in route handlers, React components, or middleware — domain services only (`packages/*`).
- The server is the source of truth for pricing, inventory, and every financial calculation. Never trust client-side values.
- Every table ships with explicit Row Level Security policies (Phase 3).
- AI may draft and recommend; it never publishes customer-facing changes without human approval.
- Secrets are server-side only. Never prefix a secret with `NEXT_PUBLIC_`.
