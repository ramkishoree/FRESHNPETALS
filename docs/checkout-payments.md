# Checkout & Payments

Implementation of the canonical roadmap's Phase 10, read against Ch.8
§88-113 (Checkout Domain, Checkout Principles, Checkout State Machine,
Payment Domain, Razorpay Integration, Order Creation, Order State
Machine, Invoice Engine, Failure Recovery, Checkout Security/Edge
Cases), Ch.16 §60-70 (Cart/Wishlist/Checkout/Orders/Coupons/Delivery-
Slots API), and Ch.16 §133-158 (Integration Architecture, Razorpay
Webhooks, Payment Reconciliation, Webhook Security, Retry Strategy) —
all read verbatim in full.

COD is explicitly out of scope for v1 (canonical decision #7). The
`payments.method` column already accommodates a future `'cod'` value
with zero schema change; nothing in this phase's design assumes online
payment is the only path.

## Core principle: the webhook is the only order-creator

Ch.8 §89 Principle 5 — "never trust frontend payment success
callbacks." Razorpay's checkout.js `handler` callback fires in the
customer's browser and cannot be trusted as proof of payment. This
phase's entire architecture follows from that one rule:

- The client never calls an endpoint that creates an order.
- Razorpay's `handler` only navigates to a processing page.
- The processing page polls a status endpoint.
- Only `POST /api/webhooks/razorpay`, authenticated by Razorpay's own
  HMAC signature on the raw request body, is allowed to create an
  order — via the `checkout_complete` RPC.

## Schema

No new tables for payments/refunds — `payments` and `refunds` already
carried `gateway`/`gateway_order_id`/`gateway_payment_id`/
`gateway_signature`/`method`/`idempotency_key` from an earlier phase.
New this phase:

| Migration | Change                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0034      | `checkout_sessions.coupon_snapshot jsonb`                                                                                                               |
| 0035      | `order_number_counters` table + `generate_order_number()` — a plain sequence doesn't reset per calendar year; this does (`FNP-2026-000001`, Ch.8 §104). |
| 0036      | `checkout_start` / `checkout_cancel` / `checkout_complete` RPCs (atomic, PostgREST has no cross-call transactions).                                     |
| 0037      | `checkout_complete` rewritten to also redeem the coupon (increment `times_used`, insert `coupon_redemptions`) in the same transaction as the order.     |

## The three RPCs

- **`checkout_start`** — locks each cart line's `inventory` row (`for
update`, stable `product_id` order to avoid deadlocks), rejects on
  insufficient stock, moves quantity into `reserved_quantity`, logs a
  `'reservation'` transaction, inserts the `checkout_sessions` row.
- **`checkout_cancel`** — idempotent no-op if the session is already
  terminal; otherwise releases the reservation and logs a
  `'reservation_release'` transaction. Used both for explicit
  cancellation and to unwind a reservation if Razorpay order creation
  fails after `checkout_start` succeeds.
- **`checkout_complete`** — the only place an `orders` row is created.
  Idempotency short-circuit keyed on `payments.idempotency_key =
razorpay_payment_id` (Ch.8 §102) returns the existing order rather
  than creating a duplicate on webhook retry. Converts the reservation
  into a sale, generates the order number, writes `order_items`,
  `payments`, `invoices`, `order_events`, and — new in 0037 — the
  coupon redemption.

All three were exercised against a real disposable Postgres container
with actual inserted data, not just read for correctness: happy path
(reserve → complete → inventory deducted, order/invoice/events all
correct), duplicate-webhook replay (same `razorpay_payment_id` twice —
`orders` count stayed at 1), cancellation (reservation fully released),
insufficient-stock rejection (no partial state change), and a full
coupon-redemption flow (`times_used` incremented exactly once,
`coupon_redemptions` row correct, discount math correct).

## Why the webhook looks up `checkout_sessions`, not `payments`

The first design considered joining through `payments.gateway_order_id`
to find the session — but no `payments` row exists until
`checkout_complete` creates one, which is the very call the webhook is
making. That lookup would always fail on first delivery. Fixed by
recording `razorpayOrderId` into `checkout_sessions.metadata` at
checkout-start time (`start-checkout.ts`), the one point both the
internal session id and the Razorpay order id are known together. The
webhook resolves the session via `metadata->>razorpayOrderId`.

The webhook also does not re-verify a `payment_id|order_id` HMAC
signature — that signature type belongs to the client-side checkout.js
success callback, which this app deliberately never trusts (Principle
5 again). The webhook's own body-level HMAC (`verifyWebhookSignature`,
checked before anything else in the handler) is the correct and
sufficient authentication for a server-to-server webhook per Ch.16
§136/§148. `verifyPaymentSignature` still exists in the adapter,
documented as unused-by-design, in case a future client-verify fast
path is ever added.

## Frontend flow

`/checkout` (session required — guests are redirected to
`/login?next=/checkout` rather than reaching a "Pay now" button that
would 401) → `CheckoutFlow` collects/selects an address and an optional
coupon code, `POST /api/v1/checkout` returns a Razorpay order, the
`Razorpay` checkout.js modal opens (loaded via `next/script` with the
request's CSP nonce) → on the client-reported success the customer is
sent to `/checkout/[sessionId]/processing`, which polls `GET
/api/v1/checkout/[sessionId]/status` every 2s (60s timeout) until the
webhook has landed and the session is `completed`, then redirects to
`/account/orders/[orderId]` (Phase 9's order detail page — already
shows order number, status timeline, line items, and invoice
download, so Ch.12 §30's Order Success Page requirements are met by
reuse rather than a duplicate page).

## Deferred (flagged, not silently dropped)

- Delivery Slot Selector UI (Ch.12 §28) — the API/service already
  accept `deliverySlotId`; no picker component yet.
- Real server-computed pricing preview before payment — the review
  step currently shows client-side subtotal only, with a disclaimer
  that delivery fee/tax/coupon are confirmed on the payment screen.
- Payment Reconciliation API (Ch.16 §137).
- Admin refund-initiation flow (table + RLS exist from an earlier
  phase; no UI/API yet).
- Order-confirmation notifications (email/WhatsApp, Ch.8 §107/§108) —
  Resend/WhatsApp integration is deferred project-wide, consistent with
  Phase 9.
