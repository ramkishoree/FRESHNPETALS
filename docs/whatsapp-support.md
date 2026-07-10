# WhatsApp Support (Meta Cloud API direct)

Built after Phase 13 (Deployment), as a direct follow-up request — not
part of the original 14-phase roadmap or the Engineering Handbook, so
there's no Ch.X citation here the way other `docs/*.md` files have one.
Architecture confirmed with the user before building (per the
`integrations-architect` skill's "Twilio & n8n: ask first" rule, applied
here to WhatsApp generally): new dedicated WhatsApp number, AI gets 2
reply attempts before escalating to the owner, both email and WhatsApp
for owner alerts, Meta's Cloud API directly rather than a BSP (Twilio/
AiSensy/Gupshup) to keep monthly cost near-zero.

## How it works

```
Order placed (Razorpay webhook → checkout_complete succeeds)
   → notifyOwnerOrderPlaced(): WhatsApp template + Resend email to the owner

Customer taps "WhatsApp Support" on their order page
   → opens WhatsApp to the dedicated number, pre-filled "Order #FP-0001: "
   → webhook (api/webhooks/whatsapp) receives the message, links it to
     that order + its customer via the "Order #X:" prefix
   → decideForCustomerMessage (packages/operations) routes it:
       - explicit "talk to a human" → escalate immediately, no AI call
       - otherwise → AI attempt (Groq by default, via AiOrchestrator,
         same governance pipeline as the 11 AI Employees — kill
         switches/budgets/prompt-injection scanning all apply — but
         called directly for a real-time reply, never through the
         Approval Queue)
   → AI self-reports whether it resolved the query
       - resolved → bot asks for 👍/👎 feedback
           - 👍 → conversation closes
           - 👎 or unclear → escalate
       - not resolved, and this was attempt 2 → escalate
       - not resolved, attempt 1 → try again (attempt 2)
   → escalation: owner notified (WhatsApp + email) with the transcript,
     customer told a human is taking over
   → owner replies from /admin → Support Inbox (not their phone — the
     dedicated number is API-only, it can't run the regular consumer
     WhatsApp app once Meta's Cloud API is registered against it)
```

## Setup (you do this — needs your Meta Business Manager login)

1. **Get a WhatsApp Business number.** A new SIM/number, not your existing
   WhatsApp Business app number (confirmed with you: keeping your current
   number on the regular app was the point of getting a dedicated one).
2. **Create a Meta App** at developers.facebook.com, add the "WhatsApp"
   product, and complete Meta Business verification (identity/business
   documents — this is the step that takes a few days).
3. **Register the number** under that app's WhatsApp product. This gives
   you: an access token, a Phone Number ID, and a WhatsApp Business
   Account ID.
4. **Set environment variables** (Vercel → Project Settings → Environment
   Variables, and locally in `apps/web/.env.local`):
   - `META_WHATSAPP_ACCESS_TOKEN` — from the app dashboard
   - `META_WHATSAPP_PHONE_NUMBER_ID` — the registered number's ID (not
     the number itself)
   - `META_WHATSAPP_BUSINESS_ACCOUNT_ID`
   - `META_WHATSAPP_APP_SECRET` — App Dashboard → Settings → Basic (used
     to verify webhook signatures, separate from the access token)
   - `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` — any string you make up, used
     once during webhook registration (step 6)
   - `META_WHATSAPP_OWNER_WA_ID` — your own WhatsApp number in
     international format with no `+`/spaces (e.g. `911234567890`) —
     where order/escalation alerts get sent
   - `NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER` — the dedicated number, same
     format, for the customer-facing wa.me link
5. **Set the email side** (also needed, since owner alerts go to both
   channels): `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (needs domain
   verification in Resend — SPF/DKIM), `OWNER_NOTIFICATION_EMAIL`.
6. **Register the webhook.** In Meta App Dashboard → WhatsApp →
   Configuration, set the callback URL to
   `https://<your-domain>/api/webhooks/whatsapp` and the verify token to
   whatever you set in step 4. Meta calls this URL once to confirm you
   control it (`GET` with a challenge — the route already handles this).
   Subscribe to the `messages` field.
7. **Submit the two message templates** (Meta App Dashboard → WhatsApp →
   Message Templates → Create). Both are **Utility** category (cheaper
   rate than Marketing, and accurate — these are transactional alerts,
   not promotions), language English:

   **`order_placed_alert`**

   ```
   New order {{1}} placed for {{2}}. Check the admin dashboard for details.
   ```

   Sample values for Meta's review: `{{1}}` = `FP-0001`, `{{2}}` = `INR 999.00`

   **`support_escalation_alert`**

   ```
   A customer conversation needs your attention (order {{1}}). Reason: {{2}}. Reply from the Support Inbox in your admin dashboard.
   ```

   Sample values: `{{1}}` = `FP-0001`, `{{2}}` = `max_attempts_reached`

   Template approval is usually same-day but can take longer. Until
   approved, `sendWhatsAppTemplate` calls will fail with a clear error
   from Meta (logged, doesn't crash anything) rather than silently
   doing nothing.

## What's built and verified vs. what needs live Meta infra

**Built and verified in this sandbox** (no live Meta account exists
here, so this is as far as verification can go without one):

- Database: `support_conversations`/`support_messages` tables, RLS
  (customer sees own via `customer_id`, admin sees all) — verified
  against a real disposable Postgres.
- Decision logic (`packages/operations/src/support/conversation-decision.ts`)
  — 23 unit tests covering every state transition, human-request
  detection, and feedback classification (including a regression test
  for "no" false-positive-matching inside "know").
- Webhook signature verification (`X-Hub-Signature-256`, HMAC-SHA256
  keyed with the App Secret) and the Meta subscription handshake — 11
  unit tests, same `timingSafeEqual` discipline as the Razorpay webhook.
- Full bot conversation flow (`bot-runtime.ts`) — 9 unit tests against
  fakes: new-conversation order-linking via the deep-link prefix, AI
  attempt → resolved/unresolved/escalate transitions, explicit
  human-request short-circuit, feedback-driven close/escalate, ignoring
  messages on closed/already-escalated conversations, and graceful
  handling of an AI/governance failure (kill switch, budget, etc.).
- Admin Support Inbox — real routes (list/detail/reply/close), RLS- and
  auth-gated, verified live (guest redirect to `/login`, 403 on the API
  without a session).
- Order-placed notification wired into the real `checkout_complete`
  webhook flow (awaited, not fire-and-forget — a serverless function can
  freeze immediately after returning a response, which would kill an
  unawaited in-flight promise).

**Needs your live Meta/Resend accounts to verify:**

- An actual template message arriving on a real phone (needs approved
  templates + a verified number).
- The full webhook round-trip against Meta's real infrastructure (this
  sandbox can't receive inbound webhooks from Meta at all — no public
  URL, no verified app).
- Whether the AI's 2-attempt resolution quality is actually good enough
  in practice — needs a review pass against a handful of real customer
  questions once it's live before trusting it fully unsupervised.
- Resend domain verification (SPF/DKIM) — without it, alert emails may
  land in spam.

## Cost

Meta's Cloud API direct means no BSP monthly platform fee — only Meta's
own per-template-message rate (India, early 2026): Utility templates
(both of ours) ≈ ₹0.115–0.25 each. At a few hundred orders/support
escalations a month, this is roughly ₹50–200/month, on top of the
Vercel/Supabase/Resend costs already covered in the earlier cost
breakdown for this project.
