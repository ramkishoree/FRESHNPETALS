# WhatsApp Order Alerts (Meta Cloud API direct)

The WhatsApp support bot (AI reply attempts, escalation, admin Support
Inbox) was removed at the owner's request — the WhatsApp integration
now does exactly one thing: alert the owner on WhatsApp the moment an
order is placed. Customers reach the owner via the "Contact us" button
on their order pages instead, which just dials a phone number directly
(`tel:` link) — no bot, no backend call routing.

## How it works

```
Order placed (Razorpay webhook or synchronous COD checkout, both via
runPostOrderSideEffects) → notifyOwnerOrderPlaced(): WhatsApp template
   to the owner with everything the order detail page itself shows —
   order id, items (+ the first item's photo as the message's header
   image), customer name, phone, delivery address, delivery date/time,
   and payment method.
```

## Setup (you do this — needs your Meta Business Manager login)

1. **Get a WhatsApp Business number**, create a Meta App at
   developers.facebook.com, add the "WhatsApp" product, and complete
   Meta Business verification.
2. **Register the number** under that app's WhatsApp product. This
   gives you an access token and a Phone Number ID.
3. **Set environment variables** (Vercel → Project Settings →
   Environment Variables, and locally in `apps/web/.env.local`):
   - `META_WHATSAPP_ACCESS_TOKEN` — from the app dashboard
   - `META_WHATSAPP_PHONE_NUMBER_ID` — the registered number's ID
   - `META_WHATSAPP_OWNER_WA_ID` — your own WhatsApp number in
     international format with no `+`/spaces (e.g. `911234567890`) —
     where the order alert gets sent
   - `NEXT_PUBLIC_OWNER_PHONE_NUMBER` — your number in `tel:`-ready
     format (e.g. `+911234567890`) for the customer-facing "Contact
     us" call button
4. **Submit the message template** (Meta App Dashboard → WhatsApp →
   Message Templates → Create). **Utility** category, language
   English, with a **HEADER** of type **Image** (dynamic — Meta will
   ask for a sample image during submission, any product photo URL
   works):

   **`order_placed_alert_v3`**

   ```
   [Header: Image]
   New order {{1}}
   {{2}}
   Customer: {{4}} ({{5}})
   Deliver to: {{6}}
   Delivery: {{8}} at {{9}}
   Total: {{3}}
   Payment: {{7}}
   ```

   Sample values for Meta's review: `{{1}}` = `FP-0001`, `{{2}}` =
   `Rose Bouquet ×2, Lily Box ×1`, `{{3}}` = `INR 999.00`, `{{4}}` =
   `Anaya Sharma`, `{{5}}` = `+911234567890`, `{{6}}` = `4/122 Vipul
Khand, Gomti Nagar, Lucknow`, `{{7}}` = `Cash on delivery`, `{{8}}` =
   `20 July 2026`, `{{9}}` = `9 AM - 11 AM`. Header sample image: any
   product photo URL from the `media` Supabase storage bucket.

   The header image is the order's first line item's product photo
   (`products.featured_image`) — sent as a `link`-type header parameter,
   not an uploaded file, so it needs no separate media upload step. If
   the order has no first-item image on file, `notifyOwnerOrderPlaced`
   omits the header component entirely rather than failing the send.

   **Image format matters, and it fails silently.** Meta renders only
   **JPEG and PNG** in an image header; WebP is sticker-only. Every photo
   in this catalogue is `.webp`, which is how alerts went missing while
   the confirmation email still arrived.

   Verified against the live Cloud API by sending both variants: a WebP
   header is **accepted synchronously** — HTTP 200, a real message id,
   `"message_status": "accepted"`. Meta fetches the image only afterwards
   and reports the delivery failure on the status webhook, which this app
   deliberately no longer subscribes to. The send therefore throws
   nothing, logs nothing, and the message never arrives. There is no
   error for the application to react to, so the format must be caught
   **before** the send.

   WebP stays the canonical format the storefront serves — reverting that
   would cost page performance for every visitor to satisfy one outbound
   integration. Instead every image is stored **twice under one name**:
   `<uuid>.webp` for the site and `<uuid>.jpg` for consumers outside the
   browser. `convertImageToJpeg` produces the sibling in the media upload
   route, `jpegSiblingUrl` derives its URL from the WebP's (no extra
   column, no storage lookup), and `notifyOwnerOrderPlaced` aims the
   header at it. Two independent guards sit behind that:
   `isSupportedHeaderImageUrl` drops any link Meta won't render, and a
   send that fails while carrying a header is retried once without it —
   so a missing sibling costs the photo, never the alert.

   Images uploaded before this change have no sibling. Backfill them:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
   node scripts/backfill-jpeg-siblings.mjs [--dry-run]
   ```

   Safe to re-run — it skips objects whose sibling already exists and
   never deletes or overwrites anything.

   Template approval is usually same-day but can take longer. Until
   approved, `sendWhatsAppTemplate` calls fail with a clear error from
   Meta (logged, doesn't crash checkout) rather than silently doing
   nothing.

## Diagnosing a missing alert

```bash
META_WHATSAPP_ACCESS_TOKEN=... META_WHATSAPP_PHONE_NUMBER_ID=... \
META_WHATSAPP_BUSINESS_ACCOUNT_ID=... META_WHATSAPP_OWNER_WA_ID=... \
node scripts/whatsapp-doctor.mjs --send
```

Checks the token and phone number registration, prints the live status of
`order_placed_alert_v3` (`APPROVED` / `PENDING` / `REJECTED` / missing)
along with its declared header format and placeholder count, and with
`--send` delivers a real test alert. Run this first — the usual cause is
a template that was never submitted or is still pending review.

## What's built and verified vs. what needs live Meta infra

**Built and verified in this sandbox:**

- `notifyOwnerOrderPlaced` wired into the real `checkout_complete`
  webhook flow (awaited, not fire-and-forget), building the alert from
  the order's own snapshot (items, address) — no extra DB round-trip.
- Fails closed (logs, never throws) when WhatsApp isn't configured or
  the send itself fails, so a WhatsApp outage never blocks an order.

**Needs your live Meta account to verify:**

- An actual template message arriving on a real phone (needs the
  `order_placed_alert_v3` template approved + a verified number).

## Cost

Meta's Cloud API direct means no BSP monthly platform fee — only
Meta's own per-template-message rate (India, early 2026): Utility
templates ≈ ₹0.115–0.25 each. At a few hundred orders/month this is
roughly ₹25–75/month.
