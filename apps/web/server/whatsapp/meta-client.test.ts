// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadClient() {
  vi.resetModules();
  return import('./meta-client');
}

describe('meta-client', () => {
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

  it('reports not configured when access token/phone number id are absent', async () => {
    const { isWhatsAppConfigured } = await loadClient();
    expect(isWhatsAppConfigured()).toBe(false);
  });

  it('reports configured once access token and phone number id are present', async () => {
    process.env['META_WHATSAPP_ACCESS_TOKEN'] = 'token';
    process.env['META_WHATSAPP_PHONE_NUMBER_ID'] = '123456';
    const { isWhatsAppConfigured } = await loadClient();
    expect(isWhatsAppConfigured()).toBe(true);
  });
});
