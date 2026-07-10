import { expect, test } from '@playwright/test';

/**
 * Ch.18 §21/§253 Production Smoke Test Procedure: "Homepage → Search →
 * Login → Product Details → Cart → Checkout → Payment Sandbox Validation
 * → CMS → AI Dashboard → Administrator Dashboard... complete within five
 * minutes." This is that sequence, scoped to what's verifiable without a
 * seeded Supabase project (no real user/product/order fixtures exist in
 * any deployed environment yet) — the deployment pipeline (Ch.18 §19)
 * runs this immediately after every deploy, guest-accessible surface
 * plus the /api/health check standing in for "Monitoring."
 *
 * Run directly (not the full E2E suite) post-deploy:
 *   pnpm exec playwright test --config=apps/web/playwright.config.ts smoke.spec.ts
 */
test.describe('Production smoke test', () => {
  test('homepage responds', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
  });

  test('authentication surface responds (login form renders)', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('search responds', async ({ page }) => {
    const response = await page.goto('/search?q=rose');
    expect(response?.status()).toBeLessThan(400);
  });

  test('product route responds (404 for an unknown slug, not a 500)', async ({ page }) => {
    const response = await page.goto('/product/does-not-exist');
    expect(response?.status()).toBe(404);
  });

  test('cart responds', async ({ page }) => {
    const response = await page.goto('/cart');
    expect(response?.status()).toBeLessThan(400);
  });

  test('checkout gate responds (redirects a guest to login)', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/login/);
  });

  test('CMS surface responds (blog index)', async ({ page }) => {
    const response = await page.goto('/blog');
    expect(response?.status()).toBeLessThan(400);
  });

  test('AI Dashboard gate responds (redirects a guest to login)', async ({ page }) => {
    await page.goto('/admin/ai');
    await expect(page).toHaveURL(/\/login/);
  });

  test('Administrator Dashboard gate responds (redirects a guest to login)', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('monitoring: /api/health responds with a structured status', async ({ request }) => {
    const response = await request.get('/api/health');
    const body = await response.json();
    expect([200, 503]).toContain(response.status());
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks.database');
    expect(body).toHaveProperty('checks.redis');
  });
});
