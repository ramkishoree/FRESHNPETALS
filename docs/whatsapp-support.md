# WhatsApp Order Alerts (Meta Cloud API direct)

The WhatsApp support bot (AI reply attempts, escalation, admin Support
Inbox) was removed at the owner's request — the WhatsApp integration
now does exactly one thing: alert the owner on WhatsApp the moment an
order is placed. Customers reach the owner via the "Contact us" button
on their order pages instead, which just dials a phone number directly
(`tel:` link) — no bot, no backend call routing.

## How it works

```
Order placed (Razorpay webhook → checkout_complete succeeds)
   → notifyOwnerOrderPlaced(): WhatsApp template to the owner with
     order id, items, customer name, phone, and delivery address
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
   English:

   **`order_placed_alert_v2`**

   ```
   New order {{1}}
   {{2}}
   Customer: {{4}} ({{5}})
   Deliver to: {{6}}
   Total: {{3}}
   ```

   Sample values for Meta's review: `{{1}}` = `FP-0001`, `{{2}}` =
   `Rose Bouquet ×2, Lily Box ×1`, `{{3}}` = `INR 999.00`, `{{4}}` =
   `Anaya Sharma`, `{{5}}` = `+911234567890`, `{{6}}` = `4/122 Vipul
Khand, Gomti Nagar, Lucknow`

   Template approval is usually same-day but can take longer. Until
   approved, `sendWhatsAppTemplate` calls fail with a clear error from
   Meta (logged, doesn't crash checkout) rather than silently doing
   nothing.

## What's built and verified vs. what needs live Meta infra

**Built and verified in this sandbox:**

- `notifyOwnerOrderPlaced` wired into the real `checkout_complete`
  webhook flow (awaited, not fire-and-forget), building the alert from
  the order's own snapshot (items, address) — no extra DB round-trip.
- Fails closed (logs, never throws) when WhatsApp isn't configured or
  the send itself fails, so a WhatsApp outage never blocks an order.

**Needs your live Meta account to verify:**

- An actual template message arriving on a real phone (needs the
  `order_placed_alert_v2` template approved + a verified number).

## Cost

Meta's Cloud API direct means no BSP monthly platform fee — only
Meta's own per-template-message rate (India, early 2026): Utility
templates ≈ ₹0.115–0.25 each. At a few hundred orders/month this is
roughly ₹25–75/month.
