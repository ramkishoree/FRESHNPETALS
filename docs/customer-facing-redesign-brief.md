# Fresh & Petals — Customer-Facing Redesign Brief

**Purpose of this file**: hand this to a design-focused AI session and ask it to redesign the visual layer of the customer-facing website. Everything described below is **already fully built and working** — the ask is a visual/layout overhaul, not new functionality.

## The one rule that matters more than anything else

**Every page/component below has two layers: data-fetching + business logic (which must not change) and JSX/styling (which is completely open to redesign).**

Concretely:

- Every `fetch('/api/...')` call, every `supabase.from(...).select(...)` query, every `onClick`/`onSubmit` handler's function body, every prop name passed into a component — **keep these exactly as they are**.
- Everything about _how it looks_ — layout, spacing, colors, typography, component structure, animations, which design system you use — **completely open to change**.
- If a redesign wants to restructure a component's internals, that's fine, **as long as the same data goes in and the same actions still fire** (same fetch URLs, same request bodies, same function calls).

If you're not sure whether something is "logic" or "presentation," treat anything involving `fetch(`, `supabase.`, `useCart()`, `router.push(`, or a Server Action import (`from '@/server/...'`) as logic to preserve. Everything else is fair game.

## Tech stack (so the redesign is compatible)

- Next.js 16, App Router, TypeScript, Server Components by default (`'use client'` only where interactivity is needed)
- Tailwind CSS v4 — current tokens live in `apps/web/app/globals.css` (CSS custom properties + `@theme`), current typography scale uses classes like `text-h2`, `text-h3`, `text-h4`, `text-body`, `text-body-lg`, `text-caption`, layout uses a `container-brand` utility class for the max-width content wrapper. **A redesign is free to replace this entire token system** — just make sure whatever replaces it is wired into the same Tailwind config location.
- UI primitives: shadcn/ui-style components in `apps/web/components/ui/*` (Button, Input, Select, Dialog, Sheet, Card, Badge, Label, Breadcrumb). Redesign can restyle or replace these entirely.
- Client state: cart is a React Context (`useCart()` from `@/lib/cart-context`) backed by `localStorage` — not server state, so page redesigns don't need to worry about server round-trips for cart operations.

## Payment flow — the most critical piece to preserve exactly

This is real money via Razorpay. The flow, end to end:

1. Customer on `/checkout` clicks **"Pay now"** → calls `POST /api/v1/checkout` with `{ lines: [{productId, quantity}], address: {...}, couponCode? }`
2. Response: `{ checkoutSessionId, razorpayOrderId, razorpayKeyId, amount, currency }`
3. Opens Razorpay's checkout modal (`window.Razorpay`, loaded via `<script src="https://checkout.razorpay.com/v1/checkout.js">`) with those exact fields
4. On payment success in the modal: clears the cart, redirects to `/checkout/[checkoutSessionId]/processing` — **this page does NOT create the order**. It polls `GET /api/v1/checkout/{sessionId}/status` every 2 seconds waiting for the order to actually appear (created by a server-to-server Razorpay webhook, not the browser) — this is intentional, a security design (frontend success is never trusted alone). Redirects to `/account/orders/{orderId}` once the poll sees `status: 'completed'`.

**A redesign can restyle the checkout page, the modal's surrounding UI, and the processing/waiting screen — but must not change**: the fetch call to `/api/v1/checkout`, the `window.Razorpay` invocation shape, the redirect targets, or the polling logic in the processing page.

## Every customer-facing route

### `/` — Homepage

**File**: `app/(storefront)/page.tsx`. Server Component, fetches (all in parallel): published products (`ListPublishedProductsService`, limit 8), active categories, one active offer, 3 most recent approved reviews.
**Sections** (in order): Hero (static headline + CTA button linking to `/shop`) → Shop by category grid (only rendered if categories exist) → Featured products grid → Offer banner (only if an active offer exists) → Customer reviews grid (only if reviews exist).
**Buttons**: "Shop now" → links to `/shop`. Product cards' add-to-cart/wishlist buttons — see Shared Components below.

### `/shop` — All products

**File**: `app/(storefront)/shop/page.tsx`. Fetches all `published` products, sorted by `?sort=` query param (`newest` default, `name_asc` option). Renders a sort `<Select>` dropdown (changes the URL's `sort` param) + product grid.

### `/shop/[category]` — Category page

**File**: `app/(storefront)/shop/[category]/page.tsx`. Same as above, filtered to one category (looked up by slug). 404s if the category slug doesn't exist or is inactive.

### `/product/[slug]` — Product detail

**File**: `app/(storefront)/product/[slug]/page.tsx`. Fetches one published product + its approved reviews.
**Layout**: breadcrumb (Home → Category → Product name) → image (left) + `ProductActions` (right) → description section → reviews grid.
**`ProductActions` component** (`components/storefront/product-actions.tsx`) — buttons:

- Quantity stepper (−/+, local state only)
- **"Add to cart"** → `useCart().addItem(...)` + toast, stays on page
- **Wishlist heart icon** → `POST /api/v1/account/wishlist` with `{productId}`; if `401`, toasts "Sign in to save products..."
- **"Buy now"** → adds to cart then `router.push('/cart')`

### `/cart`

**File**: `app/(storefront)/cart/page.tsx`. Client Component, reads `useCart()` (no server fetch — cart lives in localStorage). Empty state has a "Shop now" button → `/shop`. Non-empty: line items with quantity +/− and remove, a free-delivery-progress message (`₹999` threshold, hardcoded `FREE_DELIVERY_THRESHOLD`), subtotal, **"Proceed to checkout"** button → `/checkout`.

### `/checkout`

**File**: `app/(storefront)/checkout/page.tsx` (Server Component — redirects unauthenticated visitors to `/login?next=/checkout` server-side before rendering) + `components/storefront/checkout-flow.tsx` (Client Component, the actual form). See "Payment flow" above for the critical wiring. Additional fields: saved-address `<Select>` (fetched from `GET /api/v1/account/addresses` on mount) or a manual address form, a coupon code input (sent as `couponCode` in the checkout POST body, uppercased client-side).

### `/checkout/[sessionId]/processing`

**File**: `app/(storefront)/checkout/[sessionId]/processing/page.tsx`. Polling wait screen described above. Has a timeout fallback (60s) showing a "My Orders" link if the webhook hasn't landed yet.

### `/search`

**File**: `app/(storefront)/search/page.tsx`. Reads `?q=` param, full-text-searches products (`textSearch` on `name`) and title-searches blogs (`ilike`). Empty query shows a plain prompt; no results shows an empty state.

### `/blog`

**File**: `app/(storefront)/blog/page.tsx`. Lists published blogs (title, excerpt, featured image, published date) as cards linking to `/blog/[slug]`.

### `/blog/[slug]`

**File**: `app/(storefront)/blog/[slug]/page.tsx`. Fetches one blog + its ordered `blog_blocks` (a block-based content model — each block has a `block_type` of `'heading'`, `'paragraph'`, or `'image'`, with a `content` JSON shape of `{text?, level?, url?, alt?}`). **The block renderer switch statement must keep handling all three `block_type` values** — a redesign can restyle each case, not remove the switch.

### `/login` and `/signup`

**Files**: `app/(storefront)/login/page.tsx` + `components/storefront/login-form.tsx`; `app/(storefront)/signup/page.tsx` + `components/storefront/signup-form.tsx`.

- Login form calls the Server Action `signInWithPassword({email, password})` (imported from `@/server/auth/actions`) — not a fetch call, a direct Next.js Server Action. On success, redirects to `?next=` param or `/account`.
- Signup form calls `signUpWithPassword({email, password, fullName?})`. On success, shows a "check your email to confirm" message instead of redirecting (email confirmation required).
- Both pages have a link to the other ("New here? Create an account" / "Already have an account? Sign in").

### `/account` — Account overview

**File**: `app/(storefront)/account/page.tsx`. Three link-cards to `/account/orders`, `/account/addresses`, `/account/wishlist`, plus a sign-out button (`AccountSignOutButton` component, calls the `signOut()` Server Action).

### `/account/orders`

Lists the customer's orders (order number, total, status badge) as links to `/account/orders/[id]`.

### `/account/orders/[id]`

**File**: `app/(storefront)/account/orders/[id]/page.tsx`. Order detail: status timeline, invoice preview (line items, subtotal/tax/delivery fee/total), and the **WhatsApp Support button** (`components/commerce/whatsapp-support-button.tsx`) — deep-links to `https://wa.me/<business-number>?text=Order%20%23{orderNumber}%3A%20`. That exact `Order #{orderNumber}: ` prefix format is load-bearing — the backend bot parses it to link the WhatsApp conversation to the right order. Don't change the prefix format, the button's visual style is fully open.

### `/account/addresses`

**File** + **`components/storefront/address-manager.tsx`**. Lists saved addresses (label, recipient, address, default badge), "Add address" button opens a Dialog with a form (`POST /api/v1/account/addresses`), each address has a "Remove" button (`DELETE /api/v1/account/addresses/{id}`).

### `/account/wishlist`

Lists wishlisted products via `components/storefront/wishlist-grid.tsx` — "Add to cart" (same cart logic as everywhere else) and remove (`DELETE /api/v1/account/wishlist/{productId}`) per item.

### Static content pages: `/about`, `/faq`, `/privacy`, `/terms`, `/delivery-policy`

All four render the same shared `StaticPageContent` component (`components/storefront/static-page-content.tsx`), reading from the `static_pages` CMS table by slug, rendering `content.blocks[].text` as paragraphs. **Fully editable in `/admin/pages`** — a redesign should keep this data-driven rendering, not hardcode text.

### `/contact`

**Important**: there is **no working contact form** — Resend wasn't wired into a contact-form-submission flow. This page currently just renders whatever CMS content is published (phone/email/address), same `StaticPageContent` component as above. **If the redesign adds a contact form, flag it back to me — it needs a real backend endpoint built, it can't just be a pretty `<form>` with nowhere to submit.**

## Shared layout

### Header (`components/storefront/site-header.tsx`)

Sticky header. Logo → `/`. Desktop nav: Shop, up to 5 categories, Blog, Contact. Mobile: hamburger → slide-out `Sheet` with the same links. Search input (submits to `/search?q=...`). Account icon → `/account`. Cart icon with item-count badge (`useCart().itemCount`) → `/cart`.

### Footer (`components/storefront/site-footer.tsx`)

4-column: brand blurb, Shop links, Company links (About/Contact/FAQ/Delivery policy), Legal links (Privacy/Terms). All static `<Link>`s, no data fetching.

## Shared commerce components (used across many pages above)

- **`ProductGrid`** (`components/commerce/product-grid.tsx`) — takes `products`, `onAddToCart`, `onToggleWishlist`, optional `wishlistedIds`. Renders a responsive card grid.
- **`PriceDisplay`** (`components/commerce/price-display.tsx`) — shows base price, strikethrough + sale price if `salePrice` is set.
- **`ReviewCard`**, **`CategoryCard`**, **`OfferBanner`**, **`CartItem`**, **`InventoryBadge`**, **`DiscountBadge`**, **`OrderTimeline`**, **`InvoicePreview`** — all in `components/commerce/`, presentational, safe to fully restyle (props are simple display data, no embedded logic beyond formatting).

## AI Employees / Admin panel — out of scope

You said no need to touch admin UI. Noting for completeness since you mentioned "every agent": there are 11 AI Employee personas (Product Manager AI, SEO Specialist AI, Blog Writer AI, Marketing Manager AI, Inventory Manager AI, Pricing Analyst AI, Analytics Analyst AI, Customer Insights AI, Review Manager AI, Automation Coordinator AI, Operations Assistant AI) plus a WhatsApp support bot — all live only in `/admin/ai` and `/admin/support`, entirely separate from anything above. Nothing in this redesign brief touches them.

## What to hand back to me

For each page/component you redesign, give me the new `.tsx` file content. As long as you keep:

- The same file paths (or tell me if you renamed/restructured — I'll need to know so I can wire imports correctly)
- The same data-fetching calls and function invocations described above, verbatim
- The same component prop names where a component is called from a page I didn't ask you to touch

...I can drop the new files straight in. If anything above is genuinely incompatible with a design idea (e.g. wanting the checkout to work differently, or a contact form that needs a backend), don't quietly change the logic — flag it back so we can decide together.
