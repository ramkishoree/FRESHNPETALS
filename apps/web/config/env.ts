import { z } from 'zod';

/**
 * An env var left blank in a dashboard UI (Vercel included) is usually
 * set as an empty string, not omitted entirely — `z.string().min(1)
 * .optional()` does NOT treat those the same way (`.optional()` only
 * excuses an absent/undefined key; an explicit `""` still fails
 * `.min(1)`). Every "optional" field below is optional specifically so a
 * blank value degrades a feature instead of crashing the whole app
 * (Ch.14 §9-style graceful degradation) — so blank must be normalized to
 * `undefined` *before* validation, not treated as a validation failure.
 */
function optionalString(schema: z.ZodString = z.string().min(1)) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}
function optionalEmail() {
  return optionalString(z.string().email());
}

/**
 * Split public/server schemas so a server-only secret can never end up in
 * the client bundle by accident — importing `serverEnv` from a Client
 * Component is a type error waiting to happen, not just a convention.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // The owner's number the "Contact us" button on order pages dials
  // directly (tel: link — E.164, e.g. "+911234567890"). Optional: the
  // button just doesn't render without it.
  NEXT_PUBLIC_OWNER_PHONE_NUMBER: optionalString(),
  // Customer-facing analytics (separate from — and never used inside —
  // the admin panel, which has a hard no-analytics rule). Optional: the
  // GA4 script just doesn't render without it.
  NEXT_PUBLIC_GA_MEASUREMENT_ID: optionalString(),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: optionalString(),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  // Ch.16 §135: "Server Only." Optional — unconfigured means checkout's
  // payment-order step fails closed with a clear error, not a boot-time
  // crash.
  RAZORPAY_KEY_ID: optionalString(),
  RAZORPAY_KEY_SECRET: optionalString(),
  RAZORPAY_WEBHOOK_SECRET: optionalString(),
  // Order-placed owner WhatsApp alert (Meta Cloud API direct — no BSP
  // middleman). Optional: unconfigured means the alert send fails closed
  // with a clear error rather than a boot-time crash, same pattern as
  // Razorpay above. The inbound-message/bot side of this integration
  // (webhook signature verification, phone-number-ID-based routing) was
  // removed along with the WhatsApp support bot — only the
  // access-token+phone-number-id pair needed to *send* remains.
  META_WHATSAPP_ACCESS_TOKEN: optionalString(),
  META_WHATSAPP_PHONE_NUMBER_ID: optionalString(),
  META_WHATSAPP_OWNER_WA_ID: optionalString(),
  // Meta's own app-setup wizard requires a webhook callback URL that
  // answers its GET verification handshake before it'll let you proceed
  // through "Production setup" — this app has no inbound-message logic
  // to run (see the comment above), so the handler below only ever
  // answers that handshake and 200s any POST it's sent, unread.
  META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: optionalString(),
  // Order-placed/escalation owner email alert — optional, same fail-closed pattern.
  RESEND_API_KEY: optionalString(),
  RESEND_FROM_EMAIL: optionalEmail(),
  OWNER_NOTIFICATION_EMAIL: optionalEmail(),
  // Developer-facing free-tier usage alert (server/ops/usage-threshold-sweep.ts)
  // — deliberately separate from OWNER_NOTIFICATION_EMAIL: the store owner
  // doesn't need to know about Supabase database/storage ceilings, the
  // developer running the free tiers does.
  DEV_ALERT_EMAIL: optionalEmail(),
  // Server-side Places Details calls (outlet Google review sync) —
  // separate from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY because that key is
  // typically HTTP-referrer-restricted for client-side safety, which
  // would reject a server-to-server request with no browser Referer.
  // Falls back to the public key below if this isn't set (works only if
  // that key happens to be unrestricted).
  GOOGLE_MAPS_API_KEY: optionalString(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedPublicEnv: PublicEnv | undefined;
let cachedServerEnv: ServerEnv | undefined;

export function getPublicEnv(): PublicEnv {
  cachedPublicEnv ??= publicEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'],
    NEXT_PUBLIC_SUPABASE_URL: process.env['NEXT_PUBLIC_SUPABASE_URL'],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    NEXT_PUBLIC_OWNER_PHONE_NUMBER: process.env['NEXT_PUBLIC_OWNER_PHONE_NUMBER'],
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'],
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'],
  });
  return cachedPublicEnv;
}

export function getServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('getServerEnv() must never be called from client code.');
  }
  cachedServerEnv ??= serverEnvSchema.parse({
    ...getPublicEnv(),
    SUPABASE_SERVICE_ROLE_KEY: process.env['SUPABASE_SERVICE_ROLE_KEY'],
    UPSTASH_REDIS_REST_URL: process.env['UPSTASH_REDIS_REST_URL'],
    UPSTASH_REDIS_REST_TOKEN: process.env['UPSTASH_REDIS_REST_TOKEN'],
    CRON_SECRET: process.env['CRON_SECRET'],
    RAZORPAY_KEY_ID: process.env['RAZORPAY_KEY_ID'],
    RAZORPAY_KEY_SECRET: process.env['RAZORPAY_KEY_SECRET'],
    RAZORPAY_WEBHOOK_SECRET: process.env['RAZORPAY_WEBHOOK_SECRET'],
    META_WHATSAPP_ACCESS_TOKEN: process.env['META_WHATSAPP_ACCESS_TOKEN'],
    META_WHATSAPP_PHONE_NUMBER_ID: process.env['META_WHATSAPP_PHONE_NUMBER_ID'],
    META_WHATSAPP_OWNER_WA_ID: process.env['META_WHATSAPP_OWNER_WA_ID'],
    META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env['META_WHATSAPP_WEBHOOK_VERIFY_TOKEN'],
    RESEND_API_KEY: process.env['RESEND_API_KEY'],
    RESEND_FROM_EMAIL: process.env['RESEND_FROM_EMAIL'],
    OWNER_NOTIFICATION_EMAIL: process.env['OWNER_NOTIFICATION_EMAIL'],
    DEV_ALERT_EMAIL: process.env['DEV_ALERT_EMAIL'],
    GOOGLE_MAPS_API_KEY: process.env['GOOGLE_MAPS_API_KEY'],
  });
  return cachedServerEnv;
}
