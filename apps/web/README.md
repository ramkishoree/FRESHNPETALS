# @prana/web

Customer + admin Next.js application for Prana Commerce OS (Fresh & Petals implementation).

## Structure

- `app/` — routes (App Router)
- `components/` — shared UI components (Phase 7)
- `features/` — feature-scoped modules (cart, checkout, products, search, ...)
- `lib/` — client-safe utilities
- `server/` — server-only code (never imported from client components)
- `config/` — env/config schema and constants
- `styles/` — global styles and design tokens (Phase 2)

## Commands

```bash
pnpm dev          # start dev server
pnpm build        # production build
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest
pnpm test:e2e     # playwright
```
