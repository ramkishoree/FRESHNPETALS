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
  // The customer-facing wa.me number (E.164, digits only — e.g.
  // "911234567890"), distinct from META_WHATSAPP_PHONE_NUMBER_ID (Meta's
  // internal API identifier for that same number, used server-side only).
  // Optional: the WhatsApp Support button on order pages just doesn't
  // render without it.
  NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER: optionalString(),
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
  // Ch.14 §9: v1 providers. Optional at the schema level — an
  // unconfigured provider simply has no adapter registered (Ch.14 §68:
  // "Only approved models may be used in production" already gates this
  // at the model-registry level too) rather than the whole app failing to
  // boot because one provider key is missing.
  ANTHROPIC_API_KEY: optionalString(),
  OPENAI_API_KEY: optionalString(),
  GROQ_API_KEY: optionalString(),
  // Ch.16 §135: "Server Only." Optional for the same reason as the AI
  // provider keys above — unconfigured means checkout's payment-order
  // step fails closed with a clear error, not a boot-time crash.
  RAZORPAY_KEY_ID: optionalString(),
  RAZORPAY_KEY_SECRET: optionalString(),
  RAZORPAY_WEBHOOK_SECRET: optionalString(),
  // WhatsApp Support (Meta Cloud API direct — no BSP middleman). Optional:
  // unconfigured means order-alert/support-bot sends fail closed with a
  // clear error rather than a boot-time crash, same pattern as Razorpay/AI.
  META_WHATSAPP_ACCESS_TOKEN: optionalString(),
  META_WHATSAPP_PHONE_NUMBER_ID: optionalString(),
  META_WHATSAPP_BUSINESS_ACCOUNT_ID: optionalString(),
  META_WHATSAPP_APP_SECRET: optionalString(),
  META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: optionalString(),
  META_WHATSAPP_OWNER_WA_ID: optionalString(),
  // Order-placed/escalation owner email alert — optional, same fail-closed pattern.
  RESEND_API_KEY: optionalString(),
  RESEND_FROM_EMAIL: optionalEmail(),
  OWNER_NOTIFICATION_EMAIL: optionalEmail(),
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
    NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER: process.env['NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER'],
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
    ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'],
    OPENAI_API_KEY: process.env['OPENAI_API_KEY'],
    GROQ_API_KEY: process.env['GROQ_API_KEY'],
    RAZORPAY_KEY_ID: process.env['RAZORPAY_KEY_ID'],
    RAZORPAY_KEY_SECRET: process.env['RAZORPAY_KEY_SECRET'],
    RAZORPAY_WEBHOOK_SECRET: process.env['RAZORPAY_WEBHOOK_SECRET'],
    META_WHATSAPP_ACCESS_TOKEN: process.env['META_WHATSAPP_ACCESS_TOKEN'],
    META_WHATSAPP_PHONE_NUMBER_ID: process.env['META_WHATSAPP_PHONE_NUMBER_ID'],
    META_WHATSAPP_BUSINESS_ACCOUNT_ID: process.env['META_WHATSAPP_BUSINESS_ACCOUNT_ID'],
    META_WHATSAPP_APP_SECRET: process.env['META_WHATSAPP_APP_SECRET'],
    META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env['META_WHATSAPP_WEBHOOK_VERIFY_TOKEN'],
    META_WHATSAPP_OWNER_WA_ID: process.env['META_WHATSAPP_OWNER_WA_ID'],
    RESEND_API_KEY: process.env['RESEND_API_KEY'],
    RESEND_FROM_EMAIL: process.env['RESEND_FROM_EMAIL'],
    OWNER_NOTIFICATION_EMAIL: process.env['OWNER_NOTIFICATION_EMAIL'],
  });
  return cachedServerEnv;
}
