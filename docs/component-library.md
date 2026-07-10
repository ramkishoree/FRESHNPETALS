# Reusable Component Library

Implementation of the canonical roadmap's Phase 7: Buttons, Forms, Cards,
Tables, Dialogs, Drawer, Dropdown, Navigation, Charts, Dashboard Widgets,
Commerce Components, Loading/Empty/Error states — read against Ch.5 (Design
System), Ch.12 §82 (Commerce components), Ch.12 §83 (AI components), and
Ch.12 §86 (Charts). No real page ships in this phase; Phase 8/9 are the
first consumers.

## What exists after this phase

- **`components/ui/*`** — 32 shadcn/ui ("new-york" style) primitives on
  Radix, patched everywhere Ch.5's exact typography/radius/color rules
  differ from shadcn's generic defaults (see "Brand patches" below).
- **`components/commerce/*`** — `ProductCard`/`ProductGrid`,
  `CategoryCard`, `PriceDisplay`, `DiscountBadge`, `DeliveryBadge`,
  `InventoryBadge`, `ReviewCard`, `OfferBanner`, `CouponCard`, `CartItem`,
  `Timeline` (shared primitive) → `OrderTimeline`/`DeliveryTimeline`,
  `InvoicePreview`.
- **`components/ai/*`** — `ConfidenceBadge`, `AiSuggestionCard`,
  `ApprovalCard`, `BusinessHealthCard`, `WeeklyBrief`, `RecommendationPanel`,
  `WorkflowTimeline`, `AiActivityFeed`, `PromptDiffViewer`.
- **`components/states/*`** — `EmptyState`, `ErrorState`, `LoadingState`
  (cards/list/table-rows/text variants), `Spinner`.
- **`components/charts/*`** — `LineChart`, `AreaChart`, `BarChart`,
  `PieChart` wrapping Recharts, plus a shared `ChartTooltip`.
- **`components/data-table/*`** — TanStack Table v8 wrapper: sorting,
  global search, column visibility, row selection/bulk actions, sticky
  header, pagination.
- **`components/dashboard/stat-tile.tsx`**.
- **`components/forms/form-autosave-indicator.tsx`** + `hooks/use-autosave.ts`
  (debounced `react-hook-form` autosave with `idle/dirty/saving/saved/error`
  status).
- **`lib/chart-colors.ts`**, **`lib/format-date.ts`**, **`lib/line-diff.ts`**
  — small shared utilities the component layer needed and didn't have.

## Brand patches over shadcn's defaults

shadcn generates generic components; Ch.5 names exact values for several of
them, so the generated output was wrong out of the box in a few places:

| Component                            | shadcn default                                   | Fixed to                                                               |
| ------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------- |
| Button                               | `font-medium` (500), `text-xs` for size variants | `text-button` (16px/600 weight/1.2 line-height, Ch.5.6)                |
| Button/Card/Dialog/AlertDialog radii | generic `rounded-md`/`rounded-xl`/`rounded-lg`   | named tokens `rounded-button`/`rounded-card`/`rounded-modal` (Ch.5.10) |

New design tokens added to support this (`styles/tokens.css`):
`--text-button` (16px/600/1.2 — Ch.5.6 specifies weight/case but not size;
resolved as body size since buttons usually sit next to body text),
`--radius-sm/md/lg/xl` (derived scale for every primitive Ch.5.10 doesn't
name a radius for, so nothing falls back to Tailwind's unrelated default
scale), and a 6-color chart palette (`--chart-1`..`--chart-6`, light + dark)
validated with the `dataviz` skill's `validate_palette.js` (OKLCH lightness
band, chroma floor, Machado-2009 CVD ΔE, WCAG contrast).

## Two real bugs caught during visual QA

Both would have shipped invisibly — no lint/typecheck/test failure flagged
either; both only surfaced by actually loading the components in a browser,
which is why this phase's exit gate requires it.

### 1. Every chart rendered as empty space — CSP blocked Next's own hydration scripts

`LineChart`/`AreaChart`/`BarChart`/`PieChart` all rendered a correctly-sized
`.recharts-wrapper` div with **zero children** — no `<svg>`, no console
error. Root-caused (see `superpowers:systematic-debugging` process — full
Phase 1 investigation, ruled out duplicate-React, recharts/React 19
incompatibility, and Turbopack tree-shaking in turn) by rendering the same
`<LineChart>` under Vitest/jsdom, where it worked perfectly — isolating the
bug to the Next.js/Turbopack request pipeline specifically, not Recharts
or React itself. `list_console_messages` then surfaced 8 CSP violations:
this app's own `Content-Security-Policy` (`script-src 'self'`, Ch.11 §16)
was blocking **Next's own inline hydration/RSC-flight bootstrap scripts**.
Static SSR markup (buttons, cards) still painted fine without JS running;
Recharts' internal SVG has no meaningful SSR output at all — it's built
entirely client-side by JS that CSP was silently preventing from ever
running.

Fixed by moving CSP from a static `next.config.ts` header to a per-request
nonce minted in `proxy.ts`: `script-src 'self' 'nonce-<random>'
'strict-dynamic'` (prod), with `'unsafe-eval'` added only outside
production (Turbopack/React use `eval()` in dev for stack-trace
reconstruction; React guarantees it never calls `eval()` in production, so
prod keeps the strict policy). The nonce is threaded through as an
`x-nonce` request header so `app/layout.tsx` can read it via `headers()`
and forward it to `next-themes`' `<ThemeProvider>` (the one raw inline
`<script>` this app injects itself, its anti-FOUC theme script).

### 2. Hydration mismatch on every rendered date/timestamp

`ReviewCard`, `Timeline` (→ `OrderTimeline`/`DeliveryTimeline`),
`InvoicePreview`, and `AiActivityFeed` all called
`new Date(x).toLocaleDateString()` / `.toLocaleString()` with no locale
argument. That resolves to the _runtime's_ default locale, which differs
between the Node SSR process and the browser — server rendered
`01/06/2026`, client rendered `1/6/2026`, React discarded and re-rendered
the whole subtree. Fixed with a shared `lib/format-date.ts`
(`formatDate`/`formatDateTime`, both pinned to `en-IN` with explicit
`day/month/year` options) and rewired all four call sites plus
`components/ui/calendar.tsx`'s `data-day` attribute (same bug, same fix,
caught by inspection since Calendar isn't exercised by any page yet).

## Verified, not just written

```
pnpm format      ✓
pnpm lint        ✓
pnpm typecheck   ✓ (9/9 packages)
pnpm test        ✓ (apps/web: 64 tests)
pnpm build       ✓ (production build, Proxy/Middleware compiles)
```

Plus live browser verification (Chrome DevTools MCP): full-page screenshot
of every component category at once, zero console errors, zero dev-overlay
issues, charts rendering real SVG content, dates matching between initial
paint and after hydration. The temporary showcase page
(`app/dev-preview/**`) used for this was deleted before closing the phase —
nothing in the roadmap builds a real page until Phase 8/9.

## What's deferred (by design)

- Drawer/Navigation as their own named components — shadcn's `Sheet`
  (drawer) and the primitives navigation needs (`NavigationMenu`,
  `DropdownMenu`) are already in `components/ui/*`; a page-specific
  navigation shell is Phase 8/9's job once there's a real site structure to
  navigate.
- `RecommendationPanel`'s real recommendation data — Phase 11 (AI
  employees) is what populates it; the component itself is complete.
- CSP `'strict-dynamic'` support assumes evergreen browsers (it's ignored,
  falling back to the explicit source list, on older ones) — acceptable
  per Ch.11 §16's target browser support.
