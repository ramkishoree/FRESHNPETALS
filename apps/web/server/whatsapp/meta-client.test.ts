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

  describe('isSupportedHeaderImageUrl', () => {
    it('accepts the jpeg/png formats Meta actually renders in an image header', async () => {
      const { isSupportedHeaderImageUrl } = await loadClient();
      expect(isSupportedHeaderImageUrl('https://cdn.example.com/a/rose.jpg')).toBe(true);
      expect(isSupportedHeaderImageUrl('https://cdn.example.com/a/rose.jpeg')).toBe(true);
      expect(isSupportedHeaderImageUrl('https://cdn.example.com/a/rose.PNG')).toBe(true);
      expect(isSupportedHeaderImageUrl('https://cdn.example.com/a/rose.png?width=800')).toBe(true);
    });

    it('rejects webp, which Meta only accepts for stickers', async () => {
      const { isSupportedHeaderImageUrl } = await loadClient();
      expect(isSupportedHeaderImageUrl('https://cdn.example.com/a/rose.webp')).toBe(false);
    });

    it('rejects non-https and unparseable urls', async () => {
      const { isSupportedHeaderImageUrl } = await loadClient();
      expect(isSupportedHeaderImageUrl('http://cdn.example.com/a/rose.jpg')).toBe(false);
      expect(isSupportedHeaderImageUrl('/media/rose.jpg')).toBe(false);
      expect(isSupportedHeaderImageUrl('')).toBe(false);
    });
  });
});
