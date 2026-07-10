# Design Tokens

Implementation of Handbook **Chapter 5 — Brand Guidelines & Design System**.
Canonical per your Phase 0 decision #4: Chapter 5 values win; later chapters'
token _names_ (Ch.12 Part 4) map onto these values.

Token source: `apps/web/styles/tokens.css` (Tailwind v4 `@theme`). Imported by
`apps/web/app/globals.css`.

## Verbatim from Chapter 5

| Token                  | Value                                                                                | Handbook § |
| ---------------------- | ------------------------------------------------------------------------------------ | ---------- |
| `--color-white`        | `#FFFFFF`                                                                            | 5.5        |
| `--color-forest-green` | `#2E4B3A`                                                                            | 5.5        |
| `--color-gold`         | `#C8A25D`                                                                            | 5.5        |
| `--color-ivory`        | `#F7F3E9`                                                                            | 5.5        |
| `--color-success`      | `#3FAE49`                                                                            | 5.5        |
| `--color-error`        | `#D64545`                                                                            | 5.5        |
| `--color-warning`      | `#F5A623`                                                                            | 5.5        |
| `--color-info`         | `#2D9CDB`                                                                            | 5.5        |
| Font stack             | Geist → Inter → system-ui                                                            | 5.6        |
| Heading type           | 700 weight / -2% tracking / 110% line-height                                         | 5.6        |
| Body type              | 400 weight / 160% line-height                                                        | 5.6        |
| Button type            | 600 weight, sentence case (never uppercase)                                          | 5.6        |
| Nav type               | 500 weight                                                                           | 5.6        |
| Type scale             | Hero 64/40/32, H1 48, H2 36, H3 30, H4 24, Body-lg 18, Body 16, Caption 14, Small 12 | 5.7        |
| Grid                   | Desktop 12-col / Tablet 8-col / Mobile 4-col, container max 1280px                   | 5.8        |
| Spacing                | 8pt scale: 4,8,12,16,24,32,40,48,64,80,96,128 — never invent other values            | 5.9        |
| Radius                 | Buttons 12, Cards 16, Images 20, Modals 24, Hero cards 28                            | 5.10       |
| Shadows                | Extremely subtle, never heavy                                                        | 5.11       |
| Icons                  | Lucide only, consistent stroke, no fills, no color                                   | 5.12       |
| Motion durations       | Fast 150ms / Medium 250ms / Slow 400ms                                               | 5.17       |
| Motion allowed         | fade, slide, scale, opacity, parallax, micro-interactions                            | 5.16       |
| Motion forbidden       | bounce, spin, flash, shake, rainbow                                                  | 5.16       |
| Accessibility          | 48px min touch target, WCAG AA contrast, visible focus rings                         | 5.26       |
| Dark mode              | Not in v1; architecture must support it                                              | 5.27       |
| Responsive matrix      | 320/375/390/414/768/1024/1280/1440/1920                                              | 5.28       |

## Not specified by the handbook — chosen here (documented per Documentation policy #13)

The handbook gives brand primitives and status colors but no neutrals, no
accessible text variants of the status colors, no shadow color, and no easing
curve. Every value below was chosen for accessibility/maintainability and is
verified against WCAG 2.2 AA (contrast ≥ 4.5:1 for normal text). Computation
in this session, sRGB relative luminance:

| Token                                    | Value                                                     | Contrast on white | Use                                                                                                                            |
| ---------------------------------------- | --------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `--color-charcoal`                       | `#1A211D`                                                 | 16.42:1           | Body text (Ch.5.5 reserves forest green for headings/links/buttons/nav only — body text needed its own color)                  |
| `--color-muted-foreground`               | `#556359`                                                 | 6.33:1            | Secondary/muted text                                                                                                           |
| `--color-border`                         | `#E4DFD3`                                                 | 1.33:1            | Decorative borders/dividers only (Ch.5.11 "extremely subtle" — exempt from WCAG 1.4.11 as non-essential/decorative)            |
| `--color-input-border`                   | `#D8D2C4`                                                 | 1.51:1            | Form field resting border — accessibility for inputs relies on the focus ring (9.62:1), not the resting border, per WCAG 2.4.7 |
| `--color-success-text`                   | `#1E7A28`                                                 | 5.43:1            | Text/icon on white using the success hue (raw `--color-success` is 2.85:1 — fails AA as text)                                  |
| `--color-error-text` (= `--destructive`) | `#B23131`                                                 | 6.22:1            | Text/icon on white and solid destructive button fill (white text on it: 6.22:1)                                                |
| `--color-warning-text`                   | `#8A5A00`                                                 | 5.93:1            | Text/icon on white using the warning hue (raw `--color-warning` is 2.03:1 — fails AA badly)                                    |
| `--color-info-text`                      | `#1B6FA8`                                                 | 5.40:1            | Text/icon on white using the info hue (raw `--color-info` is 3.05:1 — fails AA)                                                |
| `--ease-premium`                         | `cubic-bezier(0.16, 1, 0.3, 1)`                           | —                 | Default easing for the "elegant, slow, purposeful" motion mandate (5.16) — nothing in the handbook specifies a curve           |
| Shadow tint                              | `rgb(46 75 58 / α)` (forest-green tinted, not pure black) | —                 | "Extremely subtle... never heavy" (5.11) reads as natural/premium rather than generic drop-shadow gray                         |

Raw handbook status colors (`--color-success/error/warning/info`) remain
available for **non-text** uses — icon fills, solid badge/button backgrounds
paired with `charcoal` foreground (all pass ≥5.4:1), left borders on alert
banners, etc. Never use them as text color directly on white.

## shadcn/ui mapping

Ch.12 Part 2 names shadcn/ui as the frontend component base (Phase 7). This
file maps Chapter 5's brand values onto shadcn's expected CSS variable names
(`--background`, `--primary`, `--muted-foreground`, etc. — see `tokens.css`)
so Phase 7 components drop in without re-theming. `--accent`/`--accent-foreground`
map to gold/charcoal (white-on-gold is 2.39:1 — fails AA, so gold always pairs
with charcoal text, never white).

## Typography scale stepping

`--text-hero` etc. hold the **desktop** value only. Chapter 5.7 gives three
sizes for Hero (64/40/32 across desktop/tablet/mobile) but only one size for
every other step — those are constants across breakpoints. Implement Hero's
responsive stepping in the Phase 7 `Heading` component with Tailwind
responsive variants (mobile-first, per Ch.5.4's "Mobile First" principle),
not as three separate tokens.

## Dark mode

`tokens.css` includes a `.dark` class with real derived values (same brand
hues, inverted for legibility) so the _architecture_ supports dark mode per
Ch.5.27. **Nothing applies this class anywhere in the codebase.** Do not wire
it to a user-facing toggle or `prefers-color-scheme` media query without
reopening Ch.5.27 — the handbook is explicit that dark mode ships dormant in
v1.

## Icons

`lucide-react` installed in `apps/web`. Ch.5.12: consistent stroke width, no
filled icons, no color (icons inherit `currentColor`).

## Brand mark

`apps/web/app/icon.svg` (auto-detected by Next.js as the favicon) and
`apps/web/public/logo-mark.svg` (same asset, for reuse in components) — a
five-petal bloom in forest green with a gold center, per CLAUDE.md's
favicon/logo generation rule and Ch.5.32 (SVG, never distorted/recolored).
A full text lockup (mark + wordmark) is a Phase 7/9 Navigation concern, not
generated here.
