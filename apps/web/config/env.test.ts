// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadEnv() {
  vi.resetModules();
  return import('./env');
}

describe('env parsing — blank optional vars must not crash (regression: NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER="" broke every request via middleware)', () => {
  beforeEach(() => {
    process.env['NEXT_PUBLIC_APP_URL'] = 'http://localhost:3100';
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'http://localhost:54321';
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = 'anon';
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service';
    process.env['UPSTASH_REDIS_REST_URL'] = 'http://localhost:8079';
    process.env['UPSTASH_REDIS_REST_TOKEN'] = 'token';
    process.env['CRON_SECRET'] = 'secret';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('treats an empty-string optional public var as absent, not invalid', async () => {
    process.env['NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER'] = '';
    const { getPublicEnv } = await loadEnv();
    expect(() => getPublicEnv()).not.toThrow();
    expect(getPublicEnv().NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER).toBeUndefined();
  });

  it('still accepts a real value for that same var', async () => {
    process.env['NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER'] = '911234567890';
    const { getPublicEnv } = await loadEnv();
    expect(getPublicEnv().NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER).toBe('911234567890');
  });

  it('treats every blank optional server var as absent, not invalid', async () => {
    process.env['RAZORPAY_KEY_ID'] = '';
    process.env['RAZORPAY_KEY_SECRET'] = '';
    process.env['RAZORPAY_WEBHOOK_SECRET'] = '';
    process.env['RESEND_FROM_EMAIL'] = '';
    process.env['OWNER_NOTIFICATION_EMAIL'] = '';
    process.env['META_WHATSAPP_ACCESS_TOKEN'] = '';
    const { getServerEnv } = await loadEnv();

    expect(() => getServerEnv()).not.toThrow();
    const env = getServerEnv();
    expect(env.RAZORPAY_KEY_ID).toBeUndefined();
    expect(env.RAZORPAY_KEY_SECRET).toBeUndefined();
    expect(env.RAZORPAY_WEBHOOK_SECRET).toBeUndefined();
    expect(env.RESEND_FROM_EMAIL).toBeUndefined();
    expect(env.OWNER_NOTIFICATION_EMAIL).toBeUndefined();
    expect(env.META_WHATSAPP_ACCESS_TOKEN).toBeUndefined();
  });

  it('still rejects a genuinely malformed (non-blank) email', async () => {
    process.env['RESEND_FROM_EMAIL'] = 'not-an-email';
    const { getServerEnv } = await loadEnv();
    expect(() => getServerEnv()).toThrow();
  });

  it('still requires the mandatory fields (CRON_SECRET) regardless of this change', async () => {
    delete process.env['CRON_SECRET'];
    const { getServerEnv } = await loadEnv();
    expect(() => getServerEnv()).toThrow();
  });
});
