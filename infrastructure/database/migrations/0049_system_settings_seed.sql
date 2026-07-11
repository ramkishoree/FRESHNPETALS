-- Seed system_settings — the table has existed since 0024 but nothing ever
-- inserted a row, so the admin Settings tab has shown "No settings
-- configured yet" since launch. Values below mirror what the app currently
-- has hardcoded (packages/commerce/src/domain/checkout.ts TAX_RATE/
-- STANDARD_DELIVERY_FEE/PER_KM_FEE, config/env.ts RESEND_FROM_EMAIL) rather
-- than inventing new numbers — editing most of these here is currently
-- display-only until each call site is migrated to read from this table
-- instead of its own constant, which is a separate follow-up.
--
-- feature_flags.ai_autonomous_scheduling_enabled is the one row wired live
-- from day one: it's the kill switch the new autonomous agent scheduler
-- checks before running anything unattended, defaulting to false so
-- turning agents loose on a schedule is an explicit opt-in, not implied by
-- this migration merely existing.

insert into public.system_settings (key, category, value, description, requires_owner) values
  ('business_name', 'business', '"Fresh & Petals"', 'Displayed in emails, invoices, and page titles.', false),
  ('business_phone', 'business', '"+91 12345 67890"', 'Shown on Contact page and order confirmations.', false),
  ('business_email', 'business', '"hello@freshnpetals.in"', 'Shown on Contact page.', false),
  ('business_address', 'business', '"Hazratganj, Lucknow, Uttar Pradesh"', 'Primary outlet address shown site-wide.', false),

  ('tax_rate_percent', 'tax', '5', 'GST rate applied at checkout. Mirrors TAX_RATE in packages/commerce — not yet read from here.', true),

  ('delivery_base_fee_inr', 'delivery', '50', 'Flat fee for the first delivery_base_km kilometers. Mirrors STANDARD_DELIVERY_FEE — not yet read from here.', false),
  ('delivery_base_km', 'delivery', '5', 'Distance covered by delivery_base_fee_inr before per-km pricing kicks in. Mirrors STANDARD_DELIVERY_KM.', false),
  ('delivery_per_km_fee_inr', 'delivery', '5', 'Fee per km beyond delivery_base_km. Mirrors PER_KM_FEE.', false),

  ('razorpay_mode', 'payment', '"test"', 'Set to "live" once you switch to live Razorpay keys in Vercel env vars.', true),

  ('seo_default_title', 'seo', '"Fresh & Petals — Fresh Flower Delivery in Lucknow"', 'Fallback page title when a page has no specific SEO title set.', false),
  ('seo_default_description', 'seo', '"Same-day fresh flower delivery in Lucknow. Bouquets, anniversary and birthday arrangements, sympathy flowers, delivered fresh."', 'Fallback meta description.', false),

  ('email_from_address', 'email', '"orders@freshnpetals.in"', 'Mirrors RESEND_FROM_EMAIL env var — not yet read from here.', true),

  ('ai_routing_default', 'ai', '"balanced"', 'Default model-routing policy for agents that do not specify one.', false),

  ('feature_flags', 'feature_flags', '{"ai_autonomous_scheduling_enabled": false, "whatsapp_support_enabled": true}', 'ai_autonomous_scheduling_enabled is a real kill switch the agent scheduler checks before running anything unattended.', true)
on conflict (key) do nothing;
